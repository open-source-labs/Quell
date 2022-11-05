FROM node:14.17
WORKDIR /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app/demo
RUN npm install 
RUN npm build
EXPOSE 3000
CMD ["npm", "start"]