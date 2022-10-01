const yargs = require('yargs');
import * as fs from 'fs';
const path = require('node:path');
const { htmlToText } = require('html-to-text');
const { hideBin } = require('yargs/helpers')
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
        console.log('Error: ${err}');
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
    attributes.forEach((value: object, index: number) => {
        var name = '';
        Object.entries(value).forEach(([key, val]) => {
            if (name == 'start') {
                if (key == 'value') {
                    numbering[level-1] = parseInt(val) - 1;
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

function nextLegalNumber(): string {
    numbering[level - 1] += 1;
    return '&nbsp;'.repeat((level - 1)*4) + numbering.slice(0, level).join('.') + '. ';
}

// There is also an alias to `convert` called `htmlToText`.
async function convertGoogleDocHtml(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.log('File ${filePath} not found.');
        return;
    }
    const inFilePath = path.parse(filePath);
    if (inFilePath.ext == '.zip') {
        console.log('Unzipping ${source} to ${targetDir}.');
        await unzipGoogleDocHtml(filePath, inFilePath.dir)
            .then((htmlFilePath) => {
                if (htmlFilePath.length == 0) {
                    console.log('Unexpected conversion failure.');
                    return;
                }
                const content = fs.readFileSync(htmlFilePath);
                const html = content.toString().replace(/<style.*<\/style>/, '<link rel="stylesheet" href="style.css">');
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
                            setLegalNumberingLevel(1);
                            startLegalNumberAt(elem.attributes);
                            walk(elem.children, builder);
                            builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
                        },
                        'olTagFormatter1': function (elem, walk, builder, formatOptions) {
                            builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                            setLegalNumberingLevel(2);
                            startLegalNumberAt(elem.attributes);
                            walk(elem.children, builder);
                            builder.closeBlock({ trailingLineBreaks: formatOptions.trailingLineBreaks || 1 });
                        },
                        'olTagFormatter2': function (elem, walk, builder, formatOptions) {
                            builder.openBlock({ leadingLineBreaks: formatOptions.leadingLineBreaks || 1 });
                            setLegalNumberingLevel(3);
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
                    },
                    selectors: [
                        {
                            selector: 'p.title',
                            format: 'titleTagFormatter',
                        },
                        {
                            selector: 'h1.c0',
                            format: 'headerTagFormatter',
                        },
                        {
                            selector: 'h2.c0',
                            format: 'headerTagFormatter',
                        },
                        {
                            selector: 'h3.c2',
                            format: 'headerTagFormatter',
                        },
                        {
                            selector: 'h4.c0',
                            format: 'headerTagFormatter',
                        },
                        {
                            selector: 'h5.c0',
                            format: 'headerTagFormatter',
                        },
                        {
                            selector: 'ol.lst-kix_sf92m2rqhri-0',
                            format: 'olTagFormatter0',
                        },
                        {
                            selector: 'ol.lst-kix_sf92m2rqhri-1',
                            format: 'olTagFormatter1',
                        },
                        {
                            selector: 'ol.lst-kix_sf92m2rqhri-2',
                            format: 'olTagFormatter2',
                        },
                        {
                            selector: 'li.li-bullet-0',
                            format: 'liTagFormatter0',
                        },
                    ]
                });

                const htmlPlainFilePath = path.join(inFilePath.dir, inFilePath.name + '_plain' + ext_html);
                console.log('Generating HTML: ${htmlPlainFilePath}.');
                if (fs.existsSync(htmlPlainFilePath)) {
                    fs.unlinkSync(htmlPlainFilePath);
                }
                fs.writeFileSync(htmlPlainFilePath, text);
                fs.renameSync(htmlPlainFilePath, path.join(inFilePath.dir, inFilePath.name + ext_html));
            })
            .catch((err) => {
                console.log('Error: ' + err.toString());
            });
    }
}

