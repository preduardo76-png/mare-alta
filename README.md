# Maré Alta — passo a passo para publicar

## 1. Criar conta no GitHub (se não tiver) e no Vercel
- github.com → crie uma conta gratuita
- vercel.com → "Continue with GitHub" (usa a mesma conta)

## 2. Subir esse projeto pro GitHub
- Crie um novo repositório vazio no GitHub (ex: "mare-alta")
- Suba todos os arquivos desta pasta para esse repositório
  (pelo site do GitHub: "uploading an existing file", arraste a pasta toda)

## 3. Importar no Vercel
- No painel do Vercel, clique "Add New" → "Project"
- Selecione o repositório "mare-alta"
- Clique em "Deploy" (não precisa mexer em nada, o Next.js é detectado automaticamente)

## 4. Ativar o armazenamento (Vercel KV) — ESSENCIAL
Sem isso o app carrega mas não salva nada.
- No projeto, dentro do Vercel, vá na aba "Storage"
- Clique em "Create Database" → escolha "KV"
- Dê um nome (ex: mare-alta-db) e conecte ao projeto
- O Vercel adiciona as variáveis de ambiente automaticamente
- Vá em "Deployments" → nos 3 pontinhos do último deploy → "Redeploy"

## 5. Instalar no celular
- Abra a URL do projeto (algo como mare-alta.vercel.app) no Chrome do celular
- Toque nos 3 pontinhos → "Instalar app" ou "Adicionar à tela inicial"
- Pronto — ícone de verdade, abre em tela cheia, funciona como app instalado

## Observações
- Todo mundo que acessar a mesma URL compartilha os mesmos dados (imóveis,
  reservas), exatamente como funcionava no artefato do Claude.
- Se quiser um domínio próprio (ex: marealta.com.br), isso é configurado
  depois, em Project Settings → Domains, no Vercel.
