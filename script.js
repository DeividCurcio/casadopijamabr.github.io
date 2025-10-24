// Rolagem suave ao clicar nos links do menu
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Chat widget frontend
const toggleBtn = document.getElementById('chat-toggle');
const panel = document.getElementById('chat-panel');
const closeBtn = document.getElementById('chat-close');
const messagesEl = document.getElementById('chat-messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');

let productCatalog = [];

// Load product catalog from catalogo.json
fetch('./catalogo.json')
  .then(r => r.json())
  .then(data => { 
    productCatalog = data; 
    console.log('Catálogo carregado:', productCatalog.length, 'produtos');
  })
  .catch(err => {
    console.log('Catálogo não encontrado, usando modo offline');
    productCatalog = [];
  });

// Verificar se os elementos existem
if (toggleBtn && panel && closeBtn && input) {
  // Toggle - abrir chat
  toggleBtn.addEventListener('click', () => {
    panel.hidden = false;
    toggleBtn.style.display = 'none';
    setTimeout(() => input.focus(), 100);
    
    // Mensagem de boas-vindas se não houver mensagens
    if (messagesEl.children.length === 0) {
      appendMessage('bot', 'Olá! 👋 Sou o assistente da Casa do Pijama BR. Como posso ajudar você hoje?');
    }
  });

  // Toggle - fechar chat
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    toggleBtn.style.display = 'block';
  });
} else {
  console.error('Elementos do chat não encontrados no DOM');
}

// Helper to append messages
function appendMessage(role, content, meta = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (meta.productThumb) {
    const img = document.createElement('img');
    img.src = meta.productThumb;
    img.className = 'product-thumb';
    wrapper.appendChild(img);
  }

  bubble.innerHTML = content;
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// When user submits
if (form && input) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    
    // Adicionar mensagem do usuário
    appendMessage('user', escapeHtml(text));
    input.value = '';
    
    // Mostrar indicador de digitação
    const thinkingId = 'thinking-' + Date.now();
    appendMessage('bot', '<em>Digitando...</em>', { id: thinkingId });

    try {
      // Tentar conectar com o servidor
      const resp = await fetch('./api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message: text, products: productCatalog})
      });
      
      // Remover indicador de digitação
      const thinkingMsg = document.querySelector(`[data-id="${thinkingId}"]`);
      if (thinkingMsg) thinkingMsg.remove();

      if (resp.ok) {
        const data = await resp.json();
        
        if (data?.replyHtml) {
          appendMessage('bot', data.replyHtml, { productThumb: data.productThumb });
        } else if (data?.reply) {
          appendMessage('bot', escapeHtml(data.reply));
        } else {
          appendMessage('bot', 'Desculpe, não consegui processar sua mensagem. 😅');
        }
      } else {
        throw new Error('Servidor indisponível');
      }
      
    } catch (err) {
      // Remover indicador de digitação
      const thinkingMsg = document.querySelector(`[data-id="${thinkingId}"]`);
      if (thinkingMsg) thinkingMsg.remove();
      
      console.error('Erro no chat:', err);
      
      // Resposta offline com informações úteis
      appendMessage('bot', `
        <p>🔌 Ops! Não consegui me conectar ao servidor.</p>
        <p>Mas posso te ajudar com algumas informações básicas:</p>
        <ul>
          <li>📱 <strong>Instagram:</strong> @full_pijama</li>
          <li>🛒 <strong>Loja na Shopee:</strong> <a href="https://br.shp.ee/8SyBhgd" target="_blank">Visitar agora</a></li>
          <li>💝 Temos pijamas femininos, masculinos e infantis</li>
          <li>🚚 Entrega rápida via Shopee</li>
        </ul>
        <p>Entre em contato pelo Instagram para atendimento personalizado!</p>
      `);
    }
  });
}

// escape to avoid XSS
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}