FROM nginx

LABEL maintainer="A3 项目维护者 <1752401825@qq.com>"

COPY ./dist/ /usr/share/nginx/html/
RUN chmod -R 777 /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
