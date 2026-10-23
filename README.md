# 🛒 SmartMarket

> **Prazo de Conclusão:** 10 de Novembro de 2026

O **SmartMarket** é uma aplicação web desenvolvida para revolucionar a experiência de compras em supermercados. O sistema permite que o cliente interaja com os produtos físicos escaneando QR Codes nas prateleiras para consultar preços, valores nutricionais, riscos de consumo e dicas. O projeto também conta com um Assistente Virtual (IA) e um Painel Administrativo completo para gestão do catálogo.

## 🔗 Links Úteis
* **Protótipo de Interface (Figma):** [Visualizar Protótipo](https://www.figma.com/make/3eMObxwukRrOVHzxJXkeyV/SmartMarket-Shopping-Experience?fullscreen=1&t=9gaKmWvaj0C4pyBM-1&code-node-id=0-6)

## 🛠️ Tecnologias Utilizadas

**Frontend (Client-side):**
* **React 19** com **TypeScript** para construção de interfaces e componentização.
* **Vite** como bundler para build ultra-rápido.
* **Tailwind CSS v4** para estilização utilitária e design responsivo.

**Backend (API & Dados):**
* **Python / Flask** para criação dos endpoints.
* **SQLite** para persistência de dados do catálogo e histórico do chat (`data/smartmarket.db`).
* **Google Gemini AI (2.5 Flash)** integrado para motor do assistente de compras inteligente.

**Infraestrutura e Deploy:**
* **Docker e Docker Compose** para conteinerização no Homelab.
* **Redis** (interno ao Docker) para controle de Rate Limiting da API.
* **GitHub Pages** para hospedagem do frontend.

---

## ✨ Funcionalidades

### Área do Cliente (Pública)
* **Catálogo e Busca:** Navegação completa pelos produtos e categorização inteligente.
* **Leitor de QR Code:** Simulação de scanner via câmera do dispositivo (sem necessidade de app externo).
* **Carrinho de Compras:** Gestão demonstrativa de carrinho com cálculo automático de subtotal.
* **Assistente Smart (Chatbot):** Recomendação de combinações, receitas e alertas de restrições (ex: glúten/lactose) utilizando IA e contexto do carrinho atual.

### Área Administrativa (Protegida)
* **Gestão de Catálogo:** Criação, edição, arquivamento e restauração de produtos.
* **Controle de Estoque:** Edição rápida e alertas automáticos para produtos com menos de 10 unidades.
* **Autenticação:** Sistema de login seguro com JWT (duração de 8 horas) e senhas em formato hash.

---

## 🚀 Como Executar Localmente

### 1. Configurando e Rodando o Backend (Homelab ou Local)
O backend é responsável por fornecer a API e conectar-se à IA.

1. Navegue até a pasta do backend e copie o modelo de variáveis de ambiente:
   ```bash
   cd backend
   cp .env.example .env
