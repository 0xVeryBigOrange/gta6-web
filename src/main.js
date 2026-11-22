import './style.css';
import { Game } from './game.js';

const root = document.getElementById('app');
const game = new Game(root);
window.__VICE = game;
game.start();
