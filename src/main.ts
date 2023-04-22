import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

import mdiVue from "mdi-vue/v3";
import * as mdiJs from "@mdi/js";

createApp(App).use(mdiVue, { icons: mdiJs }).mount("#app");
