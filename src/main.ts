import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";

import mdiVue from "mdi-vue/v3";
import * as mdiJs from "@mdi/js";

import { Tabs, Tab } from "vue3-tabs-component";

createApp(App)
.use(router)
.use(mdiVue, { icons: mdiJs })
.component('tabs', Tabs)
.component('tab', Tab)
.mount("#app");
