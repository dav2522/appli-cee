import { analyserRoute } from "./routeur.js";
document.getElementById("vue").innerHTML = "<p class='vide'>Socle en place : " + analyserRoute(location.hash).vue + "</p>";
