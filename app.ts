const yargs = require('yargs');
import * as fs from 'fs';
const path = require('node:path');
const { htmlToText } = require('html-to-text');
const { hideBin } = require('yargs/helpers')
const urlparse = require('url-parse');
const xmlunescape = require('unescape');
const queryparse = require('query-parse');

const ext_zip = '.zip';
const ext_html = '.html';

yargs(hideBin(process.argv))
    .scriptName('gdochtml2html')
    .usage('$0 <cmd> [file]')
    .command('convert [file]', 'Google docs html output converter. Produce plain HTML.', (yargs) => {
        yargs.positional('file', {
            type: 'string',
            default: '',
            describe: 'Input Google docs generated HTML file.'
        });
    }, function (argv) {
        console.log('Converting ', argv.file);
        convertGoogleDocHtml(argv.file);
    })
    .parse()


async function unzipGoogleDocHtml(source: string, target: string): Promise<string> {
    try {
        const extract = require('extract-zip');
        const fileName = path.basename(source, ext_zip);
        if (!path.isAbsolute(target)) {
            target = path.join(process.cwd(), target);
        }
        const outputPath = path.join(target, fileName.replaceAll(' ', '') + ext_html);
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

function getHrefUrl(attributes: object[]) : string {
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
    const prefix = '&nbsp;'.repeat(level * 4) + legalNumber;
    const maxLength = (level + 1) * 3 + 1;
    return prefix + '&nbsp;'.repeat(legalNumber.length <= maxLength ? (maxLength - legalNumber.length) : 1);
}

// There is also an alias to `convert` called `htmlToText`.
async function convertGoogleDocHtml(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.log(`File ${filePath} not found.`);
        return;
    }
    const inFilePath = path.parse(filePath);
    var htmlUnzippedFilePath;
    if (inFilePath.ext == '.zip') {
        console.log(`Unzipping ${inFilePath.name} to ${inFilePath.dir}.`);
        await unzipGoogleDocHtml(filePath, inFilePath.dir)
            .then((htmlFilePath) => {
                if (htmlFilePath.length == 0) {
                    console.log('Unexpected conversion failure.');
                    return;
                }
                htmlUnzippedFilePath = htmlFilePath;
                const content = fs.readFileSync(htmlFilePath);

                const html = content.toString()
                    .replace(/<style.*<\/style>/, '<link rel="stylesheet" href="style.css">')
                    .replace(/lst-kix_[a-z0-9_]+-[0-9]+/g, (v) => {
                        var s = 'lst' + v.substr(v.lastIndexOf('-'));
                        return s;
                    })
                    .replace(/li-bullet-[0-9]/g, 'li-bullet-0');

                const text = htmlToText(html, {
                    wordwrap: 300,
                    formatters: {
                        'titleTagFormatter': function (elem, walk, builder, formatOptions) {
                            builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                            builder.addInline('<h1>');
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
                            builder.addInline('<p>' + nextLegalNumber());
                            walk(elem.children, builder);
                            builder.addInline('</p>');
                            builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
                        },
                        'anchorTagFormatter': function (elem, walk, builder, formatOptions) {
                            builder.openBlock({ leadingLineBreaks: 0 });
                            builder.addInline('<a href="' + getHrefUrl(elem.attributes) + '">');
                            walk(elem.children, builder);
                            builder.addInline('</a>');
                            builder.closeBlock({ trailingLineBreaks: 0 });
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

                const htmlPlainFilePath = path.join(inFilePath.dir, inFilePath.name + '_plain' + ext_html);
                console.log(`Generating HTML: ${htmlPlainFilePath}.`);
                if (fs.existsSync(htmlPlainFilePath)) {
                    fs.unlinkSync(htmlPlainFilePath);
                }
                
                if (fs.existsSync(htmlUnzippedFilePath)) {
                    fs.unlinkSync(htmlUnzippedFilePath);
                }

                fs.writeFileSync(htmlPlainFilePath, text);
                fs.renameSync(htmlPlainFilePath, path.join(inFilePath.dir, inFilePath.name + ext_html));
            })
            .catch((err) => {
                console.log(`Error: ${err}`);
            });
    }
}

