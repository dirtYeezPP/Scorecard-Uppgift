printPlayers(getPlayers());
displaySavedGames();

//window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })
window.addEventListener('load', async () => { await updateGameViews(getPlayers()) })


/* document.querySelector('.showTotalsBtn').addEventListener('click', async () => {
    const gameInfo = await getGameInfo();
    showTotals(getPlayers(), gameInfo);
}); */

document.querySelector('.saveGameBtn').addEventListener('click', () => { saveGame(), displaySavedGames() })
document.querySelector('.startNewGameBtn').addEventListener('click', () => { startNewGame() })


// CREATE
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_");
        const scores = []; // default score to 0 if not provided 

        if (!name) return alert("even ghosts have names bro cmon");
        addPlayer(name, scores);
    })


async function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    printPlayers(players);
    await updateGameViews(players);
}


// READ GAME INFO 
function gameInfoHtml(court, players) {
    const infoDiv = ce('tr');
    infoDiv.classList.add('info');
    infoDiv.id = "courtId_" + court.id;

    const parNum = ce('td')
    parNum.innerText = court.par;

    const courtNum = ce('td')
    courtNum.innerText = court.id;

    infoDiv.appendChild(courtNum);
    infoDiv.appendChild(parNum);

    for (let player of players) {
        const playerScoreField = ce('td');
        const increasePlayerScore = ce('button');
        increasePlayerScore.innerText = '+';
        increasePlayerScore.addEventListener('click', () => { increaseScore(players, player.id, court.id) }) // dunno what to send in here yet 
        const decreasePlayerScore = ce('button');
        decreasePlayerScore.innerText = '-';
        decreasePlayerScore.addEventListener('click', () => { decreaseScore(players, player.id, court.id, court.par) })

        const scoreSpan = ce('span');
        scoreSpan.innerText = player.scores[court.id] || 0;
        scoreSpan.style.margin = "0 6px";

        playerScoreField.appendChild(decreasePlayerScore);
        playerScoreField.appendChild(scoreSpan);
        playerScoreField.appendChild(increasePlayerScore);
        infoDiv.appendChild(playerScoreField);
    }
    return infoDiv;
}

// GAME INFO IN HTML
async function printGameInfo(players) {
    let gameInfo = await getGameInfo();

    const infoBox = document.querySelector(".scoreTableDyn");
    infoBox.replaceChildren();

    const courtTitleRow = ce('tr');

    const parTitle = ce('th');
    parTitle.innerText = "par"

    const courtTitle = ce('th');
    courtTitle.innerText = "Hål";

    courtTitleRow.appendChild(courtTitle);
    courtTitleRow.appendChild(parTitle)

    const table = ce('table');
    table.appendChild(courtTitleRow);
    infoBox.appendChild(table);

    for (let player of players) {
        const playerTitle = ce('th')
        playerTitle.innerText = player.name;
        courtTitleRow.appendChild(playerTitle);
    }

    for (let court of gameInfo.court) {
        table.appendChild(gameInfoHtml(court, players));
    }
}

// RESET GAME / SAVE GAME --> NOT USED REALLY

function saveGame() {
    const currentGameInfo = localStorage.getItem('List');
    saveGameToLocalStorage(currentGameInfo);
}

function displaySavedGames() {
    const savedGamesDiv = document.querySelector(".savedGames");
    savedGamesDiv.replaceChildren();

    // loop through localStorage and find all saved games fr
    // i = o then it keeps going if its less than the lenght --> ++ is +=1 basically rawr
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i); //ts wikll hopefully never be null yes

        // filtrera bort orelevanta spel basically 
        if (!key.startsWith("game_")) {
            continue;
        }

        const rawData = localStorage.getItem(key); // get the value of the item in localStorage with the key

        // parse json om savedata = objekt , annars string fr 
        let gameData;
        try {
            gameData = JSON.parse(rawData); // if the data is a valid JSON string w object, parse it into an object
        } catch {
            gameData = rawData;
        }

        const singleGameDiv = ce("div");
        singleGameDiv.classList.add("savedGameItem");
        const savedGameTitle = ce("h4");
        //savedGameTitle.innerText = typeof gameData === "object" ? (gameData[1].name || key) : key;
        savedGameTitle.innerText = key.replace("game_", "");
        // array is an object because javascript  
        // if object --> fetches first object in array (.name gives name yes), if name not defined --> key 
        // if not object --> key after : 

        const loadGameButton = ce("button");
        loadGameButton.innerText = "load Game";
        loadGameButton.addEventListener("click", () => {
            //console.log(`loading for ${key}`, gameData)
            loadSavedGame(gameData);
        });
        const deleteSavedGameButton = ce("button");
        deleteSavedGameButton.innerText = "delete game";
        deleteSavedGameButton.addEventListener("click", () => {
            deleteSavedGame(gameData);
        });

        singleGameDiv.appendChild(savedGameTitle);
        singleGameDiv.appendChild(loadGameButton);
        singleGameDiv.appendChild(deleteSavedGameButton);
        savedGamesDiv.appendChild(singleGameDiv);
    }
    return savedGamesDiv;
}

async function loadSavedGame(gameData) {
    //const savedGame = localStorage.getItem(nameOfGame);
    console.log(gameData);
    saveToStorage(gameData);
    printPlayers(gameData);
    await updateGameViews(gameData)
}

function deleteSavedGame(gameData) {
    console.log(gameData);
}

function startNewGame() {
    if (!confirm("Are you sure you want to start a new game?")) {
        return;
    }
    let players = getPlayers();
    for (let p of players) {
        p.scores = [];
    }
    loadSavedGame(players);
}

// SCORE CONTROL  

async function increaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    player.scores[courtId] += 1;

    saveToStorage(players);
    await updateGameViews(players);
}

async function decreaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    if (!player.scores[courtId]) return; // if score is 0 or undefined or null, do nothing

    player.scores[courtId] -= 1;
    saveToStorage(players);
    await updateGameViews(players);
}

// SCORE INFORMATION IN HTML
function showTotals(players, gameInfo) {
    const scoreTotal = document.querySelector(".scoreTotal");
    if (!scoreTotal) return null;
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    scoreTotal.replaceChildren(totalTitle);
    //scoreTotal.appendChild(totalTitle);

    const courtArray = gameInfo?.court || [];
    // Optional chaining operator --> check if gameInfo exists before finding court otherwise return undefined. 

    // build object for every player {name, total, holes}
    // total --> player score for whole course, non played holes get an estimated score based on played ones. 
    const playerStats = [];

    for (let player of players) {
        // scores are saved with hole id as index, if no scores use empty array 
        const scores = player.scores || [];

        // add up the score and the par for the holes that have been played.
        let playedScore = 0;
        let playedPar = 0;
        let playedHoles = 0;
        // maybe implement a set here idk it seemed cool 

        for (let hole of courtArray) {
            const score = scores[hole.id];
            // alla banor, court1.... 

            // "score > 0" is false for undefined, null and 0, so ts skips every hole without real score
            if (score > 0) {
                playedScore += score;
                playedPar += hole.par;
                playedHoles++; // same as += 1
            }
        }


        // work out how far over/under par player is, if nothing is played we assume they play exactly par --> default 1 
        let ratio = 1;
        if (playedPar > 0) {
            ratio = playedScore / playedPar;
        }

        // go through every hole on the course
        // Played hole   --> use the real score, unplayed --> par*ratio rounden to whole num 
        let total = 0;

        for (let hole of courtArray) {
            const score = scores[hole.id];

            if (score > 0) {
                total += score;
            } else {
                total += Math.round(hole.par * ratio);
            }

        }

        playerStats.push({ name: player.name, total: total, playedHoles: playedHoles });
    }

    for (let player of playerStats) {
        const totalScoreForPlayerDiv = ce('div');
        const name = ce('h4');
        name.innerText = player.name;
        const totalScore = ce('p');
        totalScore.innerText = `Total score for ${player.name} : ${player.total}`;

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    const validPlayers = playerStats.filter(p => p.playedHoles > 0); // check that player has played wow wild crazy 
    const winnerTitle = ce('h3');

    if (validPlayers.length === 0) {
        winnerTitle.innerText = "No valid scores are recorded"
    } else {
        const lowestScore = Math.min(...validPlayers.map(p => p.total));
        //const lowestScore = validPlayers.reduce((min, p) => p.total < min ? p.total : min, validPlayers[0].total); // find the lowest total score among valid players
        const winners = validPlayers.filter(p => p.total === lowestScore); // find all players with the lowest total score
        if (winners.length > 1) {
            winnerTitle.innerText = `It's a tie between ${winners.map(p => p.name).join(", ")} with each their score being: ${lowestScore}`;
        } else {
            //const winner = winners[0]
            winnerTitle.innerText = `Winner: ${winners[0].name} with a total score of:  + ${winners[0].total}`;
        }
    }

    scoreTotal.appendChild(winnerTitle);
    return scoreTotal;
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

// DELETE 
async function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    printPlayers(newPlayerList);
    await updateGameViews(newPlayerList);
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
    //console.log(card);
    return card;
}

function saveToStorage(data) {
    const json = JSON.stringify(data); // gör om nå till en sträng
    localStorage.setItem('List', json);
}

function saveGameToLocalStorage(data) {
    let nameOfGame = null;

    while (true) {
        const input = prompt("Name your game: ")

        if (input === null) {
            return;
        }

        const trimName = input.trim();

        if (trimName.length > 0) {
            nameOfGame = trimName;
            break;
        }

        alert("even ghosts name their games bro cmon");
    }

    //const json = JSON.stringify(data);
    localStorage.setItem(`game_${nameOfGame}`, data);
}

// this one isnt used yet 
async function getSavedGameInfo() {
    const jsonCard = await fetch("SavedGames.json");
    const card = await jsonCard.json();
    console.log(card);
    return card;
}

// update totals stuff 
async function updateGameViews(players) {
    const gameInfo = await getGameInfo();
    printGameInfo(players);
    showTotals(players, gameInfo);
}

function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}