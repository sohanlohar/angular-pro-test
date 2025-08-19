FROM 972277210775.dkr.ecr.ap-southeast-1.amazonaws.com/base_images:node-16.14.0 as build
WORKDIR /app
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list && \
    apt --allow-releaseinfo-change update && npm install -g @angular/cli
COPY . .
RUN npm cache clean --force
RUN npm install 
ARG BUILD_ENV=$BUILD_ENV
RUN npx nx run ezisend:build:$BUILD_ENV
FROM 972277210775.dkr.ecr.ap-southeast-1.amazonaws.com/base_images:httpd-angular-2.4.56-alpine3.17
COPY --from=build /app/dist/apps/ezisend/ /usr/local/apache2/htdocs/
EXPOSE 80
CMD ["httpd-foreground"]