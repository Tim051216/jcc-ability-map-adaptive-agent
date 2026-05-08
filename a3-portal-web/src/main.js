import { createApp } from "vue";
import "swiper/scss";
import "swiper/scss/pagination";
import App from "./App.vue";
import "@/style/font_style/iconfont.css";
import "@/style/index.scss";
import "./permission";
import { store } from "./store";
import router from "./router";

const app = createApp(App);

app.use(store);
app.use(router);

app.mount("#app");
