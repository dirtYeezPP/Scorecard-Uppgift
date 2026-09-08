printPlayers(getPlayers());

window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })
//window.addEventListener('load', () =>  { displaySavedGames() })



document.querySelector('.showTotalsBtn').addEventListener('click', async () => {
    const gameInfo = await getGameInfo();
    showTotals(getPlayers(), gameInfo);
});

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


function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    //console.log(localStorage);
    //printPlayers([player]);
    printPlayers(players);
    printGameInfo(players)
}


// READ GAME INFO 
function gameInfoHtml(court, players) {
    const infoDiv = ce('tr');
    infoDiv.classList.add('info');
    infoDiv.id = "courtId_" + court.id;

    const parNum = ce('td')
    parNum.innerText = "avg slag: " + court.par;

    const courtNum = ce('td')
    courtNum.innerText = "Hål:" + court.id;

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

        playerScoreField.innerText = player.scores[court.id] || 0;


        playerScoreField.appendChild(increasePlayerScore);
        playerScoreField.appendChild(decreasePlayerScore);
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
    courtTitle.innerText = "court";

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

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // hämta bara relevanta spel 
        if (key.startsWith("game_") || key === "List") {
            const rawData = localStorage.getItem(key);

            // parse json om savedata = objekt , annars string fr 
            let gameData;
            try {
                gameData = JSON.parse(rawData);
            } catch {
                gameData = rawData;
            }

            const singleGameDiv = ce("div");
            singleGameDiv.classList.add("savedGameItem");
            const savedGameTitle = ce("h4");
            savedGameTitle.innerText = typeof gameData === "object" ? (gameData.title || key) : key;

            const loadGameButton = ce("button");
            loadGameButton.innerText = "load Game";
            loadGameButton.addEventListener("click", () => {
                console.log(`loading for ${key}`, gameData)
                loadSavedGame(savedGameTitle)
            })

            singleGameDiv.appendChild(savedGameTitle)
            singleGameDiv.appendChild(loadGameButton)
            savedGamesDiv.appendChild(singleGameDiv); 
        }
    }
    return savedGamesDiv;
}

function loadSavedGame(nameOfGame) {
    const savedGame = localStorage.getItem(nameOfGame);
    console.log(savedGame); 
}

function startNewGame() {

}

function showPreviousGames() {
    const savedGames = localStorage();
}

// SCORE CONTROL  

function increaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    player.scores[courtId] += 1;

    saveToStorage(players);
    printGameInfo(players);
}

function decreaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    if (!player.scores[courtId]) return; // if score is 0 or undefined or null, do nothing

    player.scores[courtId] -= 1;
    saveToStorage(players);
    printGameInfo(players);
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

    const playerStats = players.map(player => {
        let playedScoreTotes = 0;
        let playedParTote = 0;
        let estimatedScoreToteForPlayer = 0;

        // find total only for what theyve played 
        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0;
            // kollar om ett par finns in the current object from array courtArray 
            // ?? prevents me from getting fucked by undefined or nulled values (nullish coalesc)
            const score = player.scores?.[index]; //if player lacks score array

            if (score && score > 0 && currentPar > 0) {
                // checks if score exists / is greater than 0, otherwise jump to next hole 
                // check if currentpar actually has a value greater than +. 
                playedScoreTotes += score;
                playedParTote += currentPar;
            }
        })

        const overShootAverage = playedParTote > 0 ? (playedScoreTotes / playedParTote) : 1;
        // Check if holes are played, divide hits by expected par, default of 1 to not make ts thing crash tf out.

        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0;
            const score = player.scores?.[index];

            if (score && score > 0) {
                estimatedScoreToteForPlayer += score;
            } else if (currentPar > 0) {
                // if they missed hole --> multiple par by overshootAverage, vi vill ha ett heltal --> round. 
                const estimatedScore = Math.round(currentPar * overShootAverage);
                estimatedScoreToteForPlayer += estimatedScore;
            }
        }); return {
            // were giving a brand new object to replace the old one 
            name: player.name,
            total: estimatedScoreToteForPlayer
        }
    });

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

    const validPlayers = playerStats.filter(p => p.total > 0);
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

    const json = JSON.stringify(data);
    localStorage.setItem(`game_${nameOfGame}`, json);
}

// this one isnt used yet 
async function getSavedGameInfo() {
    const jsonCard = await fetch("SavedGames.json");
    const card = await jsonCard.json();
    console.log(card);
    return card;
}

function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}