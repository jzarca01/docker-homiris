FROM node:16
ENV ENVIRONMENT=DEV

WORKDIR /app

COPY ["package.json", "package-lock.json", "./"]

RUN npm install

COPY . .

CMD [ "node", "index.js" ]
