# Usa uma imagem oficial do Node.js como base
FROM node:20

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia o arquivo de configuração Firebase e o código do servidor para o container
COPY bracefaucet-firebase-adminsdk-ngeww-97d5f0ff05.json /app/
COPY firebase.json /app/
COPY .firebasesrc /app/

# Copia os arquivos do servidor e da pasta public
COPY index.js /app/
COPY package.json /app/
COPY package-lock.json /app/
COPY .gitignore /app/
COPY README.md /app/

# Copia a pasta public para dentro do container (para servir os arquivos estáticos)
COPY public /app/public/

# Instala as dependências
RUN npm install

# Exponha a porta usada pelo servidor (alterar se necessário)
EXPOSE 3000

# Comando para rodar o servidor usando npm start
CMD ["npm", "start"]
