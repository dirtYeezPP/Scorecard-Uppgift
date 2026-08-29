//printPlayers(getPlayers());

// CREATE
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_");
        if(!name) return alert("even ghosts have names bro cmon");
        addPlayer(name);
    })

function addPlayer(name) {
    if(!name) return console.log("even ghosts have names cmon bro");

    const player = { name, id: "id_" + Date.now() }

    const players = getPlayers() || []; 

    players.push(player);
    saveToStorage(players);
    console.log(localStorage);
    printPlayers([player]);
}

// READ SCORE STUFF 

// READ PLAYERS 

/**
 * 
 * @param {object} player 
 * 
 */

function playerInHtml(player) {
    const div = ce('div');
    div.classList.add('player');
    div.id = player.id;

    const title = ce('h3');
    title.innerText = player.name;

    const rmButton = ce('button');
    rmButton.innerText = "remove"
    rmButton.addEventListener('click', () => { removePlayer(player.id) })

    const addScoreBtn = ce('button');
    addScoreBtn.innerText = "+"
    const rmScoreBtn = ce('button');
    rmScoreBtn.innerText = "-"; 

    addScoreBtn.addEventListener('click', ()=>{addPlayerScore(player.id)})
    rmScoreBtn.addEventListener('click', ()=>{rmPlayerScore(player.id)})

    div.appendChild(title);
    div.appendChild(rmButton);
    div.appendChild(addScoreBtn);
    div.appendChild(rmScoreBtn); 
    return div;
}

function printPlayers(players) {
    const playersBox = document.querySelector('.players');
    for (let player of players) {
        playersBox.appendChild(playerInHtml(player));
    }
}

// UPDATE SCORES 
function rmPlayerScore(id) {
    const players = getPlayers(); 
    const player = players.find(p=>p.id==id); 

    console.log(player);
}

function addPlayerScore(id){
    const players = getPlayers(); 
    const player = players.find(p=>p.id==id);

    console.log(player);
}   

// DELETE 
function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    document.getElementById(id).remove();
}

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

// GET SCORE CARD ROUNDS FROM JSON FILE 
async function getGameInfo() {
    const jsonCard = await fetch("info.json");
    const card = await jsonCard.json(); //automatic JsonParse if you will 
    console.log(card);
    return card;
}

function saveToStorage(data) {
    const json = JSON.stringify(data);
    localStorage.setItem('List', json);
}

function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}