const axios = require("axios");
const readDoc = require('../utilities/readdoc');
const { Dropbox } = require("dropbox");
require('dotenv').config();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(':memory:');

const getAccessToken = async (req, res, next) => {
    const code = req.query.code;

    try {
        if (code) {
            db.run('delete from user_details');
            const tokenResponse = await axios.post('https://api.dropbox.com/oauth2/token', null, {
                params: {
                    code: code,
                    grant_type: 'authorization_code',
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    redirect_uri: process.env.REDIRECT_URI
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const accessToken = tokenResponse.data.access_token;
            db.run("INSERT INTO dropbox_token_details (key, token) VALUES (?, ?)", ['auth_token', accessToken], async (err) => {
                if (err) {
                    return res.status(400).send('Sorry, Something Went Wrong!!!');
                }
                else {
                    indexUserDocContent(accessToken);
                    db.all("select * from dropbox_token_details", (err, results) => {
                        if (err) {
                            return res.status(400).send('Sorry, Something Went Wrong!!!');
                        }
                        else {
                            res.redirect(process.env.APPLICATION_URL);
                        }
                    })
                }
            });
        }
        else {
            return res.status(400).send('Sorry, Something Went Wrong!!!');
        }
    }
    catch (err) {
        console.log('access_token generation err : ', err);
        return res.status(500).send('Sorry, Something Went Wrong!!!');
    }

}

const searchContent = async (req, res, next) => {
    try {
        const search = req.body.search;
        if (search) {
            db.all("SELECT * FROM dropbox_documents WHERE content LIKE ?", [`%${search}%`], (err, result) => {
                if (err) {
                    return res.status(400).send({
                        success: false,
                        message: 'Content search failed',
                        data: null,
                        error: null
                    })
                }
                else {
                    return res.status(200).send({
                        success: true,
                        data: result,
                        message: result.length ? 'Content fetched' : 'No content for this search',
                        error: null
                    })
                }
            });
        }
        else {
            return res.status(400).send({
                success: false,
                message: 'Content search failed',
                data: null,
                error: null
            })
        }
    }
    catch (err) {
        console.log('search error :', err);
        return res.status(500).send({
            success: false,
            message: 'Content search failed',
            data: null,
            error: null
        })
    }
}

const indexUserDocContent = async (token) => {

    try {
        let count = 0;
        console.log('index content');
        db.run("delete from dropbox_documents");
        const dbx = new Dropbox({ accessToken: token });
        const files = await dbx.filesListFolder({ path: "" });
        let extractFiles = files.result.entries;
        console.log(extractFiles);
        extractFiles.forEach(async (file) => {
            if (file[".tag"] === "file") {
                const fileContent = await dbx.filesDownload({ path: file.path_display });
                let fileText = "";
                if (file.name.endsWith(".pdf")) {
                    fileText = await readDoc.pdfToText(fileContent.result.fileBinary);
                }
                if (file.name.endsWith(".docx")) {
                    fileText = await readDoc.docToText(fileContent.result.fileBinary);
                }
                else if (file.name.endsWith(".txt")) {
                    fileText = fileContent.result.fileBinary.toString();
                }
                db.run("INSERT INTO dropbox_documents (name, path, content, modified) VALUES (?, ?, ?, ?)", [file.name, file.path_display, fileText, file.client_modified], async (err) => {
                    if (err) {
                        return false;
                    }
                    else {
                        console.log('file_inserted', file.name);
                        count++;
                        if (count > 99) {
                            return true;
                        }
                    }
                });
            }
            else if (file[".tag"] === "folder") {
                const folderFiles = await dbx.filesListFolder({ path: file.path_display });
                let extractFolderFiles = folderFiles.result.entries;
                extractFolderFiles.forEach(async (folderFile) => {
                    if (folderFile[".tag"] === "file") {
                        const folderFileContent = await dbx.filesDownload({ path: folderFile.path_display });
                        let folderFileText = "";
                        if (folderFile.name.endsWith(".pdf")) {
                            folderFileText = await readDoc.pdfToText(folderFileContent.result.fileBinary);
                        }
                        if (folderFile.name.endsWith(".docx")) {
                            folderFileText = await readDoc.docToText(folderFileContent.result.fileBinary);
                        }
                        else if (folderFile.name.endsWith(".txt")) {
                            folderFileText = folderFileContent.result.fileBinary.toString();
                        }
                        db.run("INSERT INTO dropbox_documents (name, path, content, modified) VALUES (?, ?, ?, ?)", [folderFile.name, folderFile.path_display, folderFileText, folderFile.client_modified], async (err) => {
                            if (err) {
                                return false;
                            }
                            else {
                                count++;
                                if (count > 99) {
                                    return true;
                                }
                            }
                        });
                    }
                });
            }
        });
    }
    catch (err) {
        console.log('indexing error :', err);
        return false;
    }
}

const checkToken = async (req, res, next) => {

    try {
        db.all("SELECT * FROM dropbox_token_details WHERE key = ?", ['auth_token'], (err, result) => {
            if (err) {
                return res.status(400).send({
                    success: false,
                    message: 'token search failed',
                    data: null,
                    error: null
                })
            }
            else {
                if (result.length) {
                    return res.status(200).send({
                        success: true,
                        data: result[0].token,
                        message: (result.length && result[0].token) ? 'Token Fetched' : 'No token',
                        error: null
                    })
                }
                else {
                    return res.status(200).send({
                        success: false,
                        data: null,
                        message: 'No token',
                        error: null
                    })
                }
            }
        });
    }
    catch (err) {
        console.log('search error :', err);
        return res.status(500).send({
            success: false,
            message: 'Token search failed',
            data: null,
            error: null
        })
    }
}

const createInitialTables = async () => {

    db.serialize(() => {
        db.run("CREATE TABLE dropbox_documents (id INTEGER PRIMARY KEY, name TEXT, path TEXT, content TEXT, modified TEXT)");
        db.run("CREATE TABLE dropbox_token_details (id INTEGER PRIMARY KEY, key TEXT, token text)");
        db.run("CREATE TABLE user_details (id INTEGER PRIMARY KEY, user_name text)");
    });
}

const getEnvProperties = async (req, res, next) => {

    try {
        let properties = {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET
        };
        return res.status(200).send(properties);
    }
    catch (err) {
        return res.status(500).send({
            client_id: null,
            client_secret: null
        });
    }
}

module.exports = {
    getAccessToken,
    searchContent,
    createInitialTables,
    checkToken,
    getEnvProperties
}
