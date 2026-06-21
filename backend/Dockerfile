FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install && npm run build

COPY app.js ./
COPY routes/user.js ./routes/

EXPOSE 80

CMD ["npx", "serve", "-s", "dist", "-l", "80"]