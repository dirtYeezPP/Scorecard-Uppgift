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