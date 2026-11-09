'use strict';
let count = 0;
const counter = document.getElementById('increment');
const theme = document.getElementById('theme');
const updateCount = () => { counter.textContent = `Count: ${count}`; };
counter.addEventListener('click', () => { count += 1; updateCount(); });
document.getElementById('reset').addEventListener('click', () => { count = 0; updateCount(); });
theme.addEventListener('click', () => {
  const light = document.body.classList.toggle('light');
  theme.setAttribute('aria-pressed', String(light));
});
document.getElementById('greeting-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.getElementById('name').value.trim();
  document.getElementById('greeting').textContent = name ? `Hello, ${name}!` : 'Please enter a name.';
});
document.getElementById('script-status').textContent = 'JavaScript loaded. Try the controls below.';
