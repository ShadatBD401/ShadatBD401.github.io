const body=document.body;
const themeBtn=document.getElementById('themeBtn');
const menuBtn=document.querySelector('.menu-btn');
const navLinks=document.querySelector('.nav-links');

const saved=localStorage.getItem('theme');
if(saved==='light') body.classList.add('light');

themeBtn.addEventListener('click',()=>{
  body.classList.toggle('light');
  localStorage.setItem('theme',body.classList.contains('light')?'light':'dark');
});

menuBtn.addEventListener('click',()=>navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

const observer=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.animate(
        [{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:600,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'}
      );
      observer.unobserve(entry.target);
    }
  });
},{threshold:.08});

document.querySelectorAll('.skill-card,.project,.cert,.edu,.timeline-item,.info-panel').forEach(el=>observer.observe(el));
