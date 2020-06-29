document.getElementById("op").addEventListener("click",()=>{
    document.getElementsByClassName("nav-list")[0].classList.add('active');
});
document.getElementById("cl").addEventListener("click",()=>{
    document.getElementsByClassName("nav-list")[0].classList.remove('active');
});