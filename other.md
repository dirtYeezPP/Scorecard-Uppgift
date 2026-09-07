``` js 
const fs = require("fs");

function getData(filename){
    return JSON.parse(fs.readFileSync(fileName).toString());
}

function saveData(fileName, data){
    data = JSON.string
}
``` 

``` js
const fs = require("fs")

function getData() {
    return JSON.parse(fs.readFileSync("arr.json").toString()) //gör om till javascript 
}

function saveData(data = []) {
    fs.writeFileSync("arr.json", (JSON.stringify(data, null, 3)))
}

function render(data) {
    return (fs.readFileSync("template.html").toString()).replace("%cats%", data) //fixa 
}

function getUserData(){
    return JSON.parse(fs.readFileSync("users.json").toString()) //json parse gör att det inte bara blir en lång sträng :skull:
}

function saveUserData(data){
    fs.writeFileSync("users.json", (JSON.stringify(data, null, 3))) //andra 'r vad vi vill skicka in i den, dvs
}
```



``` js 
function showTotals(players, gameInfo) {
    const scoreTotal = document.querySelector(".scoreTotal");
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    scoreTotal.replaceChildren();
    scoreTotal.appendChild(totalTitle);

    // This maps over every player and returns a new array of their stats
    const playerStats = players.map(player => {
        let playedScoreTotal = 0;
        let playedParTotal = 0;
        let projectedTotal = 0;

        // STEP 1: Look only at holes they actually played
        player.scores.forEach((score, index) => {
            const currentPar = gameInfo[index]?.par ?? 0; 
            
            if (score && score > 0 && currentPar > 0) { 
                playedScoreTotal += score;
                // Grab the par from the specific gameInfo object at this index
                playedParTotal += gameInfo[index].par; 
            }
        });

        // STEP 2: Find their skill level (overshoot ratio)
        const overshootRatio = playedParTotal > 0 ? (playedScoreTotal / playedParTotal) : 1;

        // STEP 3: Build the final projected score
        player.scores.forEach((score, index) => {
            const currentPar = gameInfo[index]?.par ?? 0;
            // check if index exists, if null then give undefined --> then ?? gives zero if null or undefined.  

            if (score && score > 0 ) {
                // They actually hit this, use their real score
                projectedTotal += score; 
            } else if (currentPar > 0) {
                // They missed this, guess their score based on their ratio
                const estimatedScore = Math.round(currentPar * overshootRatio);
                projectedTotal += estimatedScore;
            }
        });

        return { 
            name: player.name, 
            total: projectedTotal 
        };
    });

    // Loop through our new playerStats array to build the HTML
    for (let p of playerStats) {
        const totalScoreForPlayerDiv = ce('div');
        const name = ce('h4');
        name.innerText = p.name;
        
        const totalScore = ce('p');
        totalScore.innerText = "Projected Total Score for " + p.name + ": " + p.total;

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    // Filter out anyone who has a score of 0
    const validPlayers = playerStats.filter(p => p.total > 0); 
    
    const winnerTitle = ce('h3');
    if(validPlayers.length === 0) {
        winnerTitle.innerText = "No one has a score bro NO ONE WINS!";
        scoreTotal.appendChild(winnerTitle);
        return scoreTotal;
    }

    // STEP 4: Find the winner
    const lowestScore = validPlayers.reduce((min, p) => p.total < min ? p.total : min, validPlayers[0].total); 
    const winners = validPlayers.filter(p => p.total === lowestScore); 

    if(winners.length > 1) {
        winnerTitle.innerText = "It's a tie between: " + winners.map(p => p.name).join(", ") + " with each their score being: " + lowestScore;
    } else {
        const winner = winners[0];
        winnerTitle.innerText = "Winner: " + winner.name + " with a projected total score of: " + winner.total;
    }

    scoreTotal.appendChild(winnerTitle);
    return scoreTotal;
}
```


``` js
// STEP 1: Look only at holes they actually played
        player.scores.forEach((score, index) => {
            // Safely grab the par. If the object is null, or par is missing, it becomes 0.
            const currentPar = gameInfo[index]?.par ?? 0; 

            // Only add to the totals if they have a real score AND the hole has a real par
            if (score && score > 0 && currentPar > 0) { 
                playedScoreTotal += score;
                playedParTotal += currentPar; 
            }
        });

        // STEP 2: Find their skill level (overshoot ratio)
        const overshootRatio = playedParTotal > 0 ? (playedScoreTotal / playedParTotal) : 1;

        // STEP 3: Build the final projected score
        player.scores.forEach((score, index) => {
            const currentPar = gameInfo[index]?.par ?? 0; 

            if (score && score > 0) {
                // They actually hit this, use their real score
                projectedTotal += score; 
            } else if (currentPar > 0) {
                // They missed this, AND the hole actually exists, so guess their score
                const estimatedScore = Math.round(currentPar * overshootRatio);
                projectedTotal += estimatedScore;
            }
            // If currentPar is 0 (because the gameInfo was null), it just does nothing 
            // and moves to the next hole!
        }); 
``` 










``` js
function showTotals(players, gameInfo) {
    // 1. SET UP THE UI
    const scoreTotal = document.querySelector(".scoreTotal");
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    // Clear previous scores and add the title
    scoreTotal.replaceChildren();
    scoreTotal.appendChild(totalTitle);

    // Safely extract the course array, defaulting to an empty array if missing
    const courtArray = gameInfo?.court || [];

    // 2. CALCULATE PLAYER STATS
    const playerStats = players.map(player => {
        let playedScoreTotes = 0;
        let playedParTote = 0;
        let estimatedScoreToteForPlayer = 0;

        // Pass 1: Find their totals for ONLY the holes they actually played
        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0; 
            const score = player.scores[index]; 

            if (score && score > 0 && currentPar > 0) {
                playedScoreTotes += score;
                playedParTote += currentPar;
            }
        });

        // Determine their skill level (prevents dividing by zero if they haven't played)
        const overShootAverage = playedParTote > 0 ? (playedScoreTotes / playedParTote) : 1;

        // Pass 2: Calculate their final projected total
        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0;
            const score = player.scores[index]; 

            if (score && score > 0) {
                // Add real score
                estimatedScoreToteForPlayer += score;
            } else if (currentPar > 0) {
                // Estimate missing score based on their average
                const estimatedScore = Math.round(currentPar * overShootAverage);
                estimatedScoreToteForPlayer += estimatedScore;
            }
        }); 
        
        // Return a clean object for this player
        return {
            name: player.name, 
            total: estimatedScoreToteForPlayer
        };
    }); 

    // 3. RENDER PLAYER SCORES TO THE SCREEN
    for (let player of playerStats) {
        const totalScoreForPlayerDiv = ce('div');
        
        const name = ce('h4');
        name.innerText = player.name;
        
        const totalScore = ce('p');
        totalScore.innerText = "Total Score for " + player.name + ": " + player.total; 

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    // 4. DETERMINE THE WINNER
    // Filter out players who haven't scored a single point yet
    const validPlayers = playerStats.filter(p => p.total > 0); 
    const winnerTitle = ce('h3');

    if (validPlayers.length === 0) {
        winnerTitle.innerText = "No one has a score bro NO ONE WINS!";
    } else {
        // Find the absolute lowest score on the board
        const lowestScore = validPlayers.reduce((min, p) => p.total < min ? p.total : min, validPlayers[0].total); 
        // Find everyone who has that exact lowest score
        const winners = validPlayers.filter(p => p.total === lowestScore); 

        if (winners.length > 1) {
            winnerTitle.innerText = "It's a tie between: " + winners.map(p => p.name).join(", ") + " with each their score being: " + lowestScore;
        } else {
            const winner = winners[0];
            winnerTitle.innerText = "Winner: " + winner.name + " with a total score of: " + winner.total;
        }
    }

    // Append the winner element just once at the very end
    scoreTotal.appendChild(winnerTitle);
    return scoreTotal;
} 
```

    //const totals = players.map(p => ({ name: p.name, total: p.scores.reduce((acc, score) => acc + (score ?? 0), 0) }));


    //const validPlayers = totals.filter(p => p.total > 0); // filter out players with total score of 0
    //const winner = validPlayers.length > 0 ? validPlayers.reduce((min, p) => p.total < min.total ? p : min) : null; // find the player with the lowest total score among valid players
    // reduce here compares objects instead of crushing values into one 

    // for each index, there has to be a value, if there isnt --> 
    // take their "scores" from previous matches & compare 
    // then multiply an amount of average overshooting

        //if (validPlayers.length === 0) {
        //winnerTitle.innerText = "No one has a score bro NO ONE WINS!";
        //scoreTotal.appendChild(winnerTitle);
        //return scoreTotal;
    //} 