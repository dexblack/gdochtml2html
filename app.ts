const yargs = require('yargs');
const fs = require('fs');
const path = require('node:path');
const { htmlToText } = require('html-to-text');
const { hideBin } = require('yargs/helpers')
const urlparse = require('url-parse');
const xmlunescape = require('unescape');
const queryparse = require('query-parse');

const ext_zip = '.zip';
const ext_html = '.html';

var argv = yargs(hideBin(process.argv))
    .scriptName('gdochtml2html')
    .usage('$0 [options] <file>')
    .example('-c -f policy.zip')
    .option('c', {
        alias: 'css',
        describe: 'Use CSS based legal numbering technique. refer to "legal_style.css"',
        type: 'boolean'
    })
    .nargs('f', 1)
    .alias('f', 'file')
    .demandOption('f')
    .help('help')
    .alias('h', 'help')
    .epilog('Copyright (C) 2023. Obedient Systems. dex@dexblack.com')
    .version()
    .argv;

processFile(argv.file, argv.css);

async function processFile(file_path: string, using_css: boolean) {
    console.log('Converting ', file_path);
    await convertFile(file_path, using_css)
        .then(_ => {
            console.log('Done');
        });
}

async function unzipGoogleDocHtml(source: string, target: string): Promise<string> {
    try {
        const extract = require('extract-zip');
        const fileName = path.basename(source, ext_zip);
        if (!path.isAbsolute(target)) {
            target = path.join(process.cwd(), target);
        }
        const outputPath = path.join(target, fileName.replaceAll(' ', '').replaceAll('-', '') + ext_html);
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        await extract(source, { dir: target });
        console.log('Extraction complete');
        if (fs.existsSync(outputPath)) {
            return outputPath;
        }
        return '';
    } catch (err) {
        // handle any errors
        console.log(`Error: ${err}`);
    }
    return '';
}

function incrementHeaderTag(tag: string): string {
    return tag[0] + (parseInt(tag[1]) + 1);
}

var level: number = 0;
var numbering: number[] = [0, 0, 0, 0];

function setLegalNumberingLevel(lvl: number) {
    level = lvl;
}

function startLegalNumberAt(attributes: object[]) {
    attributes.forEach((value: object) => {
        var name = '';
        Object.entries(value).forEach(([key, val]) => {
            if (name == 'start') {
                if (key == 'value') {
                    numbering[level] = parseInt(val) - 1;
                    return;
                }
            }
            else if (key == 'name') {
                if (val == 'start') {
                    name = val;
                }
            }
        })
    });
}

function getHrefUrl(attributes: object[]): string {
    var url = '';
    attributes.forEach((value: object) => {
        var name = '';
        Object.entries(value).forEach(([key, val]) => {
            if (name == 'href') {
                url = val;
                name = '';
                return;
            }
            if (key == 'name') {
                if (val == 'href') {
                    name = val;
                }
            }
        })
    });
    const urlParsed = urlparse(url);
    const urlUnescaped = xmlunescape(urlParsed.query) as string;
    const aQuery = '?q=';
    const index = urlUnescaped.indexOf(aQuery);
    if (index >= 0) {
        const query = urlUnescaped.substr(index + 1);
        const params = queryparse.toObject(query);
        const maybeGreensUrl = params['q'];
        const host = urlparse(maybeGreensUrl).host as string;
        if (host == 'greens.org.au') {
            url = maybeGreensUrl;
        }
    }
    return url;
}

function nextLegalNumber(): string {
    numbering[level] += 1;
    const legalNumber = numbering.slice(0, level + 1).join('.') + '.';
    const prefix = legalNumber; // '&emsp;'.repeat(level * 4) + legalNumber;
    const digits = ('' + (numbering[level])).length;
    const maxLength = 3;
    return prefix + ' '.repeat(digits <= maxLength ? (maxLength - digits) : 1);
}

// There is also an alias to `convert` called `htmlToText`.
async function convertFile(filePath: string, css: boolean) {
    if (!fs.existsSync(filePath)) {
        console.log(`File ${filePath} not found.`);
        return;
    }
    const inFilePath = path.parse(filePath);
    var htmlUnzippedFilePath;
    if (inFilePath.ext == '.zip') {
        console.log(`Unzipping to "${inFilePath.dir}${path.delimiter}${inFilePath.name}".`);
        await unzipGoogleDocHtml(filePath, inFilePath.dir)
            .then((htmlFilePath) => {
                if (htmlFilePath.length == 0) {
                    console.log('Unexpected conversion failure.');
                    return;
                }
                htmlUnzippedFilePath = htmlFilePath;
                const content = fs.readFileSync(htmlFilePath);

                const htmlPlainFilePath = path.join(inFilePath.dir, inFilePath.name + '_plain' + ext_html);
                console.log(`Generating HTML: ${htmlPlainFilePath}.`);
                if (fs.existsSync(htmlPlainFilePath)) {
                    fs.unlinkSync(htmlPlainFilePath);
                }

                if (fs.existsSync(htmlUnzippedFilePath)) {
                    fs.unlinkSync(htmlUnzippedFilePath);
                }

                var text = css
                    ? convertUsingOlTags(content)
                    : convertUsingPlainHtml(content);

                fs.writeFileSync(htmlPlainFilePath, text);
                fs.renameSync(htmlPlainFilePath, path.join(inFilePath.dir, inFilePath.name + ext_html));
            })
            .catch((err) => {
                console.log(`Error: ${err}`);
            });
    }
}

function convertUsingOlTags(content: any) {
    const html = content.toString()
        .replace(/<style.*<\/style>/, '<link rel="stylesheet" href="legal_style.css">')
        .replace(/lst-kix_[a-z0-9_]+-[0-9]+/g, (v) => {
            var s = 'lst' + v.substr(v.lastIndexOf('-'));
            return s;
        })
        .replace(/li-bullet-[0-9]/g, 'li-bullet-0');

    var continued = [false, false, false]; // one for each level of legal numbering; olTagFormatter0, 1, 2.
    return htmlToText(html, {
        wordwrap: 300,
        formatters: {
            'titleTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<h1 class="policy">');
                walk(elem.children, builder);
                builder.addInline('</h1>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'subtitleTagFormatter': function (elem, walk, builder, formatOptions) {
            },
            'headerTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                const newH = incrementHeaderTag(elem.name);
                builder.addInline('<' + newH + '>');
                walk(elem.children, builder);
                builder.addInline('</' + newH + '>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter0': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<ol class="policy' + (continued[0] ? ' continued' : '') + '">');
                walk(elem.children, builder);
                builder.addInline('</ol>');
                continued[0] = true;
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter1': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<ol class="policy">');
                walk(elem.children, builder);
                builder.addInline('</ol>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter2': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<ol class="policy">');
                walk(elem.children, builder);
                builder.addInline('</ol>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'liTagFormatter0': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<li>');
                walk(elem.children, builder);
                builder.addInline('</li>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'anchorTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<a href="' + getHrefUrl(elem.attributes) + '">');
                walk(elem.children, builder);
                builder.addInline('</a>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'paragraphTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<p>');
                walk(elem.children, builder);
                builder.addInline('</p>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            }
        },
        selectors: [
            {
                selector: 'p.title',
                format: 'titleTagFormatter',
            },
            {
                selector: 'h1',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h2',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h3',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h4',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h5',
                format: 'headerTagFormatter',
            },
            {
                selector: 'ol.lst-0',
                format: 'olTagFormatter0',
            },
            {
                selector: 'ol.lst-1',
                format: 'olTagFormatter1',
            },
            {
                selector: 'ol.lst-2',
                format: 'olTagFormatter2',
            },
            {
                selector: 'li.li-bullet-0',
                format: 'liTagFormatter0',
            },
            {
                selector: 'a',
                format: 'anchorTagFormatter'
            },
            {
                selector: 'p',
                format: 'paragraphTagFormatter'
            }
        ]
    });
}

function convertUsingPlainHtml(content: any) {
    const html = content.toString()
        .replace(/<style.*<\/style>/, '<link rel="stylesheet" href="style.css">')
        .replace(/lst-kix_[a-z0-9_]+-[0-9]+/g, (v) => {
            var s = 'lst' + v.substr(v.lastIndexOf('-'));
            return s;
        })
        .replace(/li-bullet-[0-9]/g, 'li-bullet-0');

    return htmlToText(html, {
        wordwrap: 300,
        formatters: {
            'titleTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline(
                    //'<html>' +
                    '<style type="text/css">' +
                    '< !--/*--><![CDATA[/* ><!--*/' +
                    '.policy { counter-reset: section; }' +
                    '.policy h2:before {   counter-increment: section; }' +
                    '.policy ol { counter-reset: clause; list-style: none outside none; text-indent: -2em; }' +
                    '.policy ol li { counter-increment: clause; }' +
                    '.policy ol li:before { content: counter(section) "." counters(clause, ".") ". "; margin: 0 0.5em 0 0.5em; }' + '/*--><!]]>*/' +
                    '</style>'
                    //+ '<body>'
                );
                builder.addInline('<h1 id="policy">');
                walk(elem.children, builder);
                builder.addInline('</h1>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'subtitleTagFormatter': function (elem, walk, builder, formatOptions) {
            },
            'headerTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                const newH = incrementHeaderTag(elem.name);
                builder.addInline('<' + newH + '>');
                walk(elem.children, builder);
                builder.addInline('</' + newH + '>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter0': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                setLegalNumberingLevel(0);
                startLegalNumberAt(elem.attributes);
                walk(elem.children, builder);
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter1': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                setLegalNumberingLevel(1);
                startLegalNumberAt(elem.attributes);
                walk(elem.children, builder);
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'olTagFormatter2': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                setLegalNumberingLevel(2);
                startLegalNumberAt(elem.attributes);
                walk(elem.children, builder);
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'liTagFormatter0': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<p class="' + 'indent--hanging__' + level + '">' + nextLegalNumber());
                walk(elem.children, builder);
                builder.addInline('</p>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
            'anchorTagFormatter': function (elem, walk, builder, formatOptions) {
                builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                builder.addInline('<a href="' + getHrefUrl(elem.attributes) + '">');
                walk(elem.children, builder);
                builder.addInline('</a>');
                builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
            },
        },
        selectors: [
            {
                selector: 'p.title',
                format: 'titleTagFormatter',
            },
            {
                selector: 'h1',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h2',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h3',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h4',
                format: 'headerTagFormatter',
            },
            {
                selector: 'h5',
                format: 'headerTagFormatter',
            },
            {
                selector: 'ol.lst-0',
                format: 'olTagFormatter0',
            },
            {
                selector: 'ol.lst-1',
                format: 'olTagFormatter1',
            },
            {
                selector: 'ol.lst-2',
                format: 'olTagFormatter2',
            },
            {
                selector: 'li.li-bullet-0',
                format: 'liTagFormatter0',
            },
            {
                selector: 'a',
                format: 'anchorTagFormatter'
            }
        ]
    });
}

