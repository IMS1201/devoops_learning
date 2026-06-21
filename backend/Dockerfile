FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY app.js ./
COPY routes/user.js ./routes/

EXPOSE 8000

CMD ["node", "app.js"]