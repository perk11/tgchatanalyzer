let loader, errorOutput, output;
let directoryContents;
window.addEventListener('load',function () {
    loader = document.getElementById('loader');
    output = document.getElementById('output');
    errorOutput = document.getElementById('error');
    document.getElementById('directory-input').addEventListener('change', handleDirSelect)
});
const handleError = function (errorMessage) {
    document.getElementById('select-another-file').style.display = 'block';
    errorOutput.innerHTML = 'Error: ' + errorMessage.replace("\n", '<br>');
    errorOutput.style.display = 'block';
    loader.style.display = 'none';
}
function parseResultJSON(data) {
    try {
        const jsonData = JSON.parse(data);
        if (!jsonData.hasOwnProperty('name')) {
            jsonData.name = "Unknown";
        }
        document.getElementById('chat-name').textContent = jsonData.name;
        if (!jsonData.hasOwnProperty('messages')) {
            handleError('JSON file selected does not have a property "messages", make sure valid Telegram chat history export is selected.');
            return;
        }
        let messages = jsonData.messages;
        let messagesCount = messages.length;
        let textMessagesCount = 0;
        let lastMessageUnixTimestamp = 0;
        document.getElementById('total-messages').textContent = messagesCount;
        let authors = {};
        let stickers = {};
        const requiredProperties = ['type', 'from', 'date_unixtime']
        messageLoop: for (let messageId = 0; messageId < messagesCount; messageId++) {
            let message = messages[messageId];
            if (message.hasOwnProperty('type') && message.type !== 'message') {
                continue;
            }
            for (let requiredPropertyIndex = 0; requiredPropertyIndex < requiredProperties.length; requiredPropertyIndex++) {
                let property = requiredProperties[requiredPropertyIndex];
                if (!message.hasOwnProperty(property)) {
                    if (message.hasOwnProperty('id')) {
                        console.error(`Message ${message.id} has no property "${property}"`);
                    } else {
                        console.error(`Message has no property "${property}" and no "id"`);
                    }
                    continue messageLoop;
                }
            }

            textMessagesCount++;


            let author = message.from;
            let messageDay = formatDate(new Date(message.date_unixtime * 1000))
            let words = {};
            let sticker;
            if (message.hasOwnProperty('media_type') && message.media_type === 'sticker') {
                sticker = {};
                if (message.hasOwnProperty('thumbnail')) {
                    sticker.thumbnail = message.thumbnail;
                }
                if (message.hasOwnProperty('file')) {
                    if (message.file === '(File not included. Change data exporting settings to download.)') {
                        continue;
                    }
                    sticker.file = message.file;
                } else {
                    console.error(`Message ${message.id} with media_type "sticker" has no property "file"`);
                    continue;
                }
            } else {
                words = countWords(parseIntoWords(message));
            }
            if (!authors.hasOwnProperty(author)) {
                authors[author] = {
                    name: author,
                    totalMessages: 1,
                    firstMessage: message.date_unixtime,
                    lastMessage: message.date_unixtime,
                    activeDays: [
                        messageDay,
                    ],
                    words: words,
                    stickers: {},
                }
            } else {
                let authorObj = authors[author];
                authorObj.totalMessages++;
                authorObj.lastMessage = Math.max(message.date_unixtime, authorObj.lastMessage);
                authorObj.firstMessage = Math.min(message.date_unixtime, authorObj.firstMessage);
                if (authorObj.activeDays.indexOf(messageDay) === -1) {
                    authorObj.activeDays.push(messageDay);
                }
                for (const word in words) {
                    if (authorObj.words.hasOwnProperty(word)) {
                        authorObj.words[word] += words[word];
                    } else {
                        authorObj.words[word] = words[word];
                    }
                }
            }
            if (sticker !== undefined) {
                let stickerFileName = sticker.file;
                if (stickers.hasOwnProperty(stickerFileName)) {
                    stickers[stickerFileName].useNumber++;
                } else {
                    stickers[stickerFileName] = sticker;
                    stickers[stickerFileName].useNumber = 1;
                    stickers[stickerFileName].useByAuthor = {}
                }
                if (stickers[stickerFileName].useByAuthor.hasOwnProperty(author)) {
                    stickers[stickerFileName].useByAuthor[author]++;
                } else {
                    stickers[stickerFileName].useByAuthor[author] = 1;
                }
                if (authors[author].stickers.hasOwnProperty(stickerFileName)) {
                    authors[author].stickers[stickerFileName].useNumber++;
                } else {
                    authors[author].stickers[stickerFileName] = 1;
                }
            }
            lastMessageUnixTimestamp = Math.max(message.date_unixtime, lastMessageUnixTimestamp);
        }
        document.getElementById('text-messages').textContent = textMessagesCount.toString();
        let numberFormat = Intl.NumberFormat();
        let participantsTableBodyHTML = ''

        let authorsArray = Object.values(authors);
        authorsArray.sort(function (a, b) {
            if (a.totalMessages > b.totalMessages) {
                return -1;
            }
            if (a.totalMessages < b.totalMessages) {
                return 1;
            }
            return 0;
        });
        for (let authorIndex = 0; authorIndex < authorsArray.length; authorIndex++) {
            let author = authorsArray[authorIndex];
            let daysSinceJoin = (lastMessageUnixTimestamp - author.firstMessage) / (3600 * 24);
            let wordsArray = Object.entries(author.words).sort((a, b) => b[1] - a[1]);
            let topWords = '';
            let topWordsNumber = 10;
            topWordsNumber = Math.min(topWordsNumber, wordsArray.length);
            for (let i = 0; i < topWordsNumber - 1; i++) {
                topWords += wordsArray[i][0] + ':' + wordsArray[i][1] + ', ';
            }
            if (topWordsNumber > 0) {
                topWords += wordsArray[topWordsNumber - 1][0] + ':' + wordsArray[topWordsNumber - 1][1];
            }
            participantsTableBodyHTML += `
<tr>
<td>${numberFormat.format(authorIndex + 1)}</td>
<td style="max-width:200px; text-overflow: ellipsis">${author.name}</td>
<td>${numberFormat.format(author.totalMessages)}</td>
<td>${formatDate(new Date(author.firstMessage * 1000))}</td>
<td>${formatDate(new Date(author.lastMessage * 1000))}</td>
<td>${numberFormat.format((author.totalMessages / daysSinceJoin).toFixed(1))}</td>
<td>${numberFormat.format(author.activeDays.length)}</td>
<td>${topWords}</td>
</tr>`
        }
        document.getElementById('participants-table-body').innerHTML = participantsTableBodyHTML;

        loader.innerHTML="Processing stickers...";
        let stickerTableBodyHTML = '';
        let stickersArray = Object.values(stickers);
        stickersArray.sort(function (a, b) {
            if (a.useNumber > b.useNumber) {
                return -1;
            }
            if (a.useNumber < b.useNumber) {
                return 1;
            }
            return 0;
        });
        let numberOfTopStickersToDisplay = Math.min(200, stickersArray.length)
        let queuedFileReads = [];
        for (let stickerIndex = 0; stickerIndex < numberOfTopStickersToDisplay; stickerIndex++) {
            let sticker = stickersArray[stickerIndex];
            let usersArray = Object.entries(sticker.useByAuthor).sort((a, b) => b[1] - a[1]);
            let topUsers = '';
            let topUsersNumber = 10;
            topUsersNumber = Math.min(topUsersNumber, usersArray.length);
            for (let i = 0; i < topUsersNumber - 1; i++) {
                //todo: fix XSS here and in top words
                topUsers += usersArray[i][0] + ': ' + usersArray[i][1] + '<br>';
            }
            if (topUsersNumber > 0) {
                topUsers += usersArray[topUsersNumber - 1][0] + ': ' + usersArray[topUsersNumber - 1][1];
            }
            let stickerElementId=`sticker-${sticker.file}`;
            if (directoryContents.hasOwnProperty(sticker.file)) {
                queuedFileReads.push(function () {
                    if (sticker.file.endsWith('.webp') || sticker.file.endsWith('.webm') || sticker.file.endsWith('.tgs')) {
                        let reader = new FileReader();
                        if (sticker.file.endsWith('.webp') || sticker.file.endsWith('.webm')) {
                            reader.readAsDataURL(directoryContents[sticker.file]);
                        } else {
                            reader.readAsArrayBuffer(directoryContents[sticker.file]);
                        }
                        reader.onload = function (e) {
                            const span = document.createElement('span');
                            if (sticker.file.endsWith('.webp')) {
                                span.innerHTML = `<img src="${e.target.result}" alt="Sticker">`;
                            } else if (sticker.file.endsWith('.webm')) {
                                span.innerHTML = `<video autoplay loop src="${e.target.result}">`;
                            } else if (sticker.file.endsWith('.tgs')) {
                                //convert from data-uri to JSON
                                try {
                                    let arrayBuffer = new Uint8Array(e.target.result);
                                    let decompressed = pako.inflate(arrayBuffer);
                                    let text = new TextDecoder("utf-8").decode(decompressed);
                                    let animationData = JSON.parse(text);
                                    lottie.loadAnimation({
                                        container: span, // the dom element
                                        renderer: 'svg',
                                        loop: true,
                                        autoplay: true,
                                        animationData: animationData,
                                    });
                                } catch (e) {
                                    document.getElementById(stickerElementId).innerHTML = `<span class='sticker-load-error'>Failed to load sticker: ${e.message}</span>`;
                                }
                            } else {
                                document.getElementById(stickerElementId).innerHTML = "<span class='sticker-load-error'>Tried to load unsupported format</span>";
                                return;
                            }
                            document.getElementById(stickerElementId).appendChild(span);
                        }
                        reader.onerror = function (e) {
                            document.getElementById(stickerElementId).innerHTML = "<span class='sticker-load-error'>Failed to load sticker</span>";
                        }
                    } else {
                        document.getElementById(stickerElementId).innerHTML = "<span class='sticker-load-error'>Unsupported format</span>";
                    }
                })
            } else {
                queuedFileReads.push(function () {
                    document.getElementById(stickerElementId).innerHTML = `<span class='sticker-load-error'>File not found: ${sticker.file} </span>`;
                });
            }
            stickerTableBodyHTML += `
<tr>
<td>${numberFormat.format(stickerIndex + 1)}</td>
<td id="sticker-${sticker.file}" class="sticker-display"></td>
<td>${numberFormat.format(sticker.useNumber)}</td>
<td>${topUsers}</td>
</tr>`
        }
        document.getElementById('stickers-table-body').innerHTML = stickerTableBodyHTML;
        output.style.display = 'block';
        // error.style.display = 'none';
        loader.style.display = 'none';
        document.getElementById('select-another-file').style.display = 'block';
        for (let i=0; i<queuedFileReads.length; i++) {
            queuedFileReads[i]();
        }
        if (stickersArray.length === 0) {
            document.getElementById('stickers-container').style.display = 'none';
        } else {
            document.getElementById('stickers-container').style.display = 'block';
        }
    } catch (error) {
        handleError(error + "\n" + error.stack);
    }
}

function formatDate(date)
{
    return date.toISOString().split('T')[0];
}

function parseIntoWords(message) {
    if (!message.hasOwnProperty('text_entities')) {
        console.error("Message has no text_entities property");
    }
    let words = [];
    for (let textEntityIndex = 0; textEntityIndex < message.text_entities.length; textEntityIndex++) {
        let text = message.text_entities[textEntityIndex].text;
        let newWords = text.match(/\p{L}+/gu);
        words = words.concat(newWords)
    }
    return words;
}

const excludedWords = [
    'и', 'не', 'в', 'на','с', 'это','то', 'что', 'у', 'же', 'я', 'он', 'она', 'оно', 'его', 'их', 'там', 'так', 'да', 'нет', 'вот', 'если', 'а', 'ну', 'по', 'для', 'за', 'но', 'все',  'как', 'от', 'еще', 'из', 'только', 'можно', 'меня', 'было', 'или', 'ты', 'че', 'есть', 'к', 'бы', 'уже', 'будет', 'без', 'о', 'мне', 'под', 'https', 'com', 'ru', 'ещё', 'даже', 'ага'
];
function countWords(words) {
    let uniqueWords = {};
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        let word = words[wordIndex];
        if (word === null) {
            continue;
        }
        word = word.toLowerCase();
        if (excludedWords.indexOf(word) !== -1) {
            continue;
        }
        if (uniqueWords.hasOwnProperty(word)) {
            uniqueWords[word]++;
        } else {
            uniqueWords[word] = 1;
        }
    }
    return uniqueWords;
}
function startLoading()
{
    loader.style.display = 'block';
    output.style.display = 'none';
    document.getElementById('file-container').style.display = 'none';
}

function readFile(file) {
    if (file) {
        loader.innerHTML="Processing " + file.name + '...';
        const reader = new FileReader();
        reader.addEventListener('load', function (e) {
            parseResultJSON(e.target.result)
        });
        reader.addEventListener('error', function (e) {
            handleError('Failed to parse selected file: ' + e);
        });
        reader.readAsText(file);
    }
}

function handleFileSelect(event) {
    if (document.readyState !== 'complete') {
        console.log("Document load hasn't finished, repeating the attempt to handle file select in 300ms")
        setTimeout(function (){
            handleFileSelect(event);
        }, 300);
        return;
    }
    startLoading();
    const file = event.target.files[0];
    readFile(file);

}
function handleDirSelect(event) {
    if (document.readyState !== 'complete') {
        console.log("Document load hasn't finished, repeating the attempt to handle file select in 300ms")
        setTimeout(function (){
            handleDirSelect(event);
        }, 300);
        return;
    }
    startLoading();
    loader.innerHTML="Reading directory...";
    directoryContents = {};
    let resultJson;
    for (const file of event.target.files) {
        if (file.name ==='result.json') {
            resultJson = file;
        } else {
            //remove top directory and store file in directoryContents variable based on relative path for easy access later
            let pathParts = file.webkitRelativePath.split('/');
            pathParts = pathParts.slice(1);
            let path = pathParts.join('/');
            directoryContents[path] = file;
        }
    }
    if (resultJson === undefined) {
        handleError('File named "result.json" not found in selected directory.');
        return;
    }
    readFile(resultJson);

}
function reset() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('loader').innerHTML = '';
    document.getElementById('output').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('select-another-file').style.display = 'none';
    document.getElementById('file-container').style.display = 'block';
}
