// Este servidor não expõe sua chave: coloque OPENAI_API_KEY em variáveis de ambiente.
// server/index.js
const express = require('express');
const fetch = require('node-fetch'); // ou use undici
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // servir site estático se desejar

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) console.warn("OPENAI_API_KEY não encontrada nas variáveis de ambiente.");

app.post('/api/chat', async (req, res) => {
  try {
    const { message, products } = req.body;

    // 1) Construir contexto: (prompt system + produtos)
    const systemPrompt = `
Você é o Assistente virtual da Casa do Pijama BR. Ajude o cliente de forma cordial em português (pt-BR). Use apenas dados do catálogo quando precisar informar preço, descrição e link. 
Se o cliente pedir recomendação, faça 1-3 sugestões com:
 - título do produto (negrito),
 - preço,
 - descrição curta,
 - miniatura (se disponível) e link "Ver na Shopee".
Se o cliente pedir foto nova ou variação, ofereça gerar imagem (explique custo/tempo se aplicável) e peça confirmação antes de gerar.
Use HTML simples na resposta (parágrafos, <a>, <img width="120">, <ul><li>) para facilitar render no chat. Não invente preços.
Se não souber, peça mais informações (tamanho, cor, orçamento).
`;

    // Validar entrada
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida' });
    }

    // 2) Transformar catálogo em texto resumido
    const productSummary = products && products.length ? products.slice(0,50).map(p => {
      return `ID:${p.id} | ${p.title} | ${p.price} | ${p.description} | URL:${p.shopee_url}`;
    }).join('\n') : 'Sem produtos disponíveis no momento';

    // 3) Montar payload para LLM - combinando catálogo e pergunta em uma mensagem
    const userMessage = `CATÁLOGO DE PRODUTOS:
${productSummary}

PERGUNTA DO CLIENTE: ${message}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 4) Verificar se temos a API key
    if (!OPENAI_KEY) {
      return res.status(500).json({ 
        reply: 'Desculpe, o serviço de chat está temporariamente indisponível. Entre em contato pelo Instagram @full_pijama!' 
      });
    }

    // 5) Chamada à API da OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('Erro da OpenAI:', response.status, await response.text());
      return res.json({ 
        reply: 'Desculpe, estou com dificuldades no momento. Tente novamente em alguns segundos ou visite nossa loja direto na Shopee!' 
      });
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('Erro da API:', data.error);
      return res.json({ 
        reply: 'Ops, algo deu errado. Entre em contato pelo nosso Instagram @full_pijama para atendimento direto!' 
      });
    }

    const assistantText = data?.choices?.[0]?.message?.content;
    
    if (!assistantText) {
      return res.json({ 
        reply: 'Desculpe, não consegui processar sua pergunta. Pode reformular ou entrar em contato pelo Instagram @full_pijama?' 
      });
    }

    // Enviar resposta em HTML
    res.json({ replyHtml: assistantText });
  } catch (err) {
    console.error('Erro no chat:', err.message);
    res.json({ 
      reply: 'Desculpe, ocorreu um erro. Tente novamente ou visite nossa loja diretamente na Shopee! 🛍️' 
    });
  }
});

// Endpoint opcional para gerar imagem (integração com API de imagens)
app.post('/api/generate-image', async (req,res) => {
  try {
    const { prompt, style } = req.body;
    // Exemplo com OpenAI Images (ajuste conforme o provedor real)
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method:'POST',
      headers:{ 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt, n:1, size:'1024x1024' })
    });
    const j = await r.json();
    const imgBase64 = j?.data?.[0]?.b64_json;
    if (imgBase64) {
      res.json({ imageBase64: imgBase64 });
    } else {
      res.status(500).json({ error: 'sem imagem' });
    }
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'erro ao gerar imagem' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server rodando na porta ${PORT}`));