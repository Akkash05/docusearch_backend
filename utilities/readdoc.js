const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const pdfToText = async (fileBuffer) => {
    try {
        const data = await pdfParse(fileBuffer);
        return data.text;
    } catch (error) {
        console.error("Error extracting PDF text:", error);
        return "";
    }
}

const docToText = async (fileBuffer) => {
    try {
        const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
        return value;
    } catch (error) {
        console.error("Error extracting DOCX text:", error);
        return "";
    }
}

module.exports = {
    pdfToText,
    docToText
}