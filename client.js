printPlayers(getPlayers());

window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })

// CREATE
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_");
        if (!name) return alert("even ghosts have names bro cmon");
        addPlayer(name);
    })

function addPlayer(name) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    console.log(localStorage);
    //printPlayers([player]);
    printPlayers(players);
    printGameInfo(players)
}

// READ GAME INFO 

function gameInfoHtml(court, players) {
    const infoDiv = ce('tr');
    infoDiv.classList.add('info');
    infoDiv.id = court.id;

    const courtNum = ce('td')
    courtNum.innerText = court.par;

    infoDiv.appendChild(courtNum);

    for (let player of players) {
        const playerScore = ce('td');
        playerScore.innerText = "s";
        infoDiv.appendChild(playerScore);
    }
    
    return infoDiv;
}

async function printGameInfo(players) {
    let gameInfo = await getGameInfo();

    const infoBox = document.querySelector(".scoreTableDyn");

    infoBox.replaceChildren();

    const courtTitleRow = ce('tr');
    const courtTitle = ce('th');
    courtTitle.innerText = "court";
    courtTitleRow.appendChild(courtTitle);
    const table = ce('table');
    table.appendChild(courtTitleRow);
    infoBox.appendChild(table);


    for (let player of players) {
        const playerTitle = ce('th')
        playerTitle.innerText = player.name;
        courtTitleRow.appendChild(playerTitle);
    }

    //infoBox.replaceChildren();
    for (let court of gameInfo.court) {
        table.appendChild(gameInfoHtml(court, players));
    }
}

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

    div.appendChild(title);
    div.appendChild(rmButton);
    return div;
}

function printPlayers(players) {
    const playersBox = document.querySelector('.players');
    playersBox.replaceChildren();
    for (let player of players) {
        playersBox.appendChild(playerInHtml(player));
    }
}

// UPDATE SCORES 


// DELETE 
function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    //document.getElementById(id).remove();
    printPlayers(newPlayerList);
    printGameInfo(newPlayerList);
}

// HELPER FUNCTIONS 


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