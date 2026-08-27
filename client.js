// CREATE

// CREATE THE FORM 

function createForm() {

    const main = qs('main');
    const div = ce('div', 'form'); // div med klassen form 
    const form = ce('form');
    const inp1 = ce('input');
    const inp2 = ce('input');
    const inp3 = ce('input');
    const submit = ce('input', 'submit');

    inp1.type = "text"; 
    inp1.placeholder = "name first player?";
    inp2.type = "text";
    inp2.placeholder = "name second player?";
    inp3.type = "text";
    inp3.placeholder = "name third player?";

    submit.type = "submit";
    submit.value = "save";

    form.appendChild(inp1);
    form.appendChild(inp2);
    form.appendChild(inp3);
    form.appendChild(submit);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert("rawr");
    });

    div.appendChild(form);
    main.appendChild(div);

}


// READ

// UPDATE

// DELETE 

// HELPER FUNCTIONS 

// QUERY SELECTOR 
function qs(selector) {
    const el = document.querySelectorAll(selector);

    if (el.length == 1) return el[0]; // return one element only  
    return el;  
}

// CREATE ELEMENT 
function ce(elementType, className = null) {  
    const el = document.createElement(elementType);
    if (className) el.classList.add(className); 
    return el; 
}

// GET SCORE CARD FROM JSON FILE 
async function getScoreCard(){
    const jsonCard = await fetch("info.json");
    const card = await jsonCard.json(); //automatic JsonParse if you will 
    console.log(card);
    return card; 
}