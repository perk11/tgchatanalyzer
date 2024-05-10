let loader, errorOutput, output;
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
            let words = countWords(parseIntoWords(message));
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
        console.log(lastMessageUnixTimestamp);
        console.log(authorsArray);
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
        participantsTableBodyHTML = undefined;

        output.style.display = 'block';
        // error.style.display = 'none';
        loader.style.display = 'none';
        document.getElementById('select-another-file').style.display = 'block';

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
    let resultJson;
    for (const file of event.target.files) {
        console.log(file.webkitRelativePath);
        if (file.webkitRelativePath.endsWith('/result.json')) {
            resultJson = file;
            break;
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
    document.getElementById('output').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('select-another-file').style.display = 'none';
    document.getElementById('file-container').style.display = 'block';
}
