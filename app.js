var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const yargs = require('yargs');
const fs = require('fs');
const path = require('node:path');
const { htmlToText } = require('html-to-text');
const { hideBin } = require('yargs/helpers');
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
    .parse();
function unzipGoogleDocHtml(source, target) {
    return __awaiter(this, void 0, void 0, function* () {
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
            yield extract(source, { dir: target });
            console.log('Extraction complete');
            if (fs.existsSync(outputPath)) {
                return outputPath;
            }
            return '';
        }
        catch (err) {
            // handle any errors
            console.log(`Error: ${err}`);
        }
        return '';
    });
}
function incrementHeaderTag(tag) {
    return tag[0] + (parseInt(tag[1]) + 1);
}
var level = 0;
var numbering = [0, 0, 0, 0];
function setLegalNumberingLevel(lvl) {
    level = lvl;
}
function startLegalNumberAt(attributes) {
    attributes.forEach((value) => {
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
        });
    });
}
function getHrefUrl(attributes) {
    var url = '';
    attributes.forEach((value) => {
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
        });
    });
    const urlParsed = urlparse(url);
    const urlUnescaped = xmlunescape(urlParsed.query);
    const aQuery = '?q=';
    const index = urlUnescaped.indexOf(aQuery);
    if (index >= 0) {
        const query = urlUnescaped.substr(index + 1);
        const params = queryparse.toObject(query);
        const maybeGreensUrl = params['q'];
        const host = urlparse(maybeGreensUrl).host;
        if (host == 'greens.org.au') {
            url = maybeGreensUrl;
        }
    }
    return url;
}
function nextLegalNumber() {
    numbering[level] += 1;
    const legalNumber = numbering.slice(0, level + 1).join('.') + '.';
    const prefix = legalNumber; // '&emsp;'.repeat(level * 4) + legalNumber;
    const digits = ('' + (numbering[level])).length;
    const maxLength = 3;
    return prefix + '&emsp;'.repeat(digits <= maxLength ? (maxLength - digits) : 1);
}
// There is also an alias to `convert` called `htmlToText`.
function convertGoogleDocHtml(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(filePath)) {
            console.log(`File ${filePath} not found.`);
            return;
        }
        const inFilePath = path.parse(filePath);
        var htmlUnzippedFilePath;
        if (inFilePath.ext == '.zip') {
            console.log(`Unzipping ${inFilePath.name} to ${inFilePath.dir}.`);
            yield unzipGoogleDocHtml(filePath, inFilePath.dir)
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
                            builder.addInline(
                            //'<html>' +
                            '<style type="text/css">' +
                                '< !--/*--><![CDATA[/* ><!--*/' +
                                '.indent--hanging__0 { padding-left: 2.4em; text-indent: -2.6em; }' +
                                '.indent--hanging__1 { padding-left: 5.7em; text-indent: -3.4em; }' +
                                '.indent--hanging__2 { padding-left: 10.3em; text-indent: -4.7em; }' +
                                '.indent--hanging__3 { padding-left: 14.3em; text-indent: -5.7em; }' +
                                '.indent--hanging__4 { padding-left: 21.1em; text-indent: -7em; }' +
                                '/*--><!]]>*/' +
                                '</style>'
                            //+ '<body>'
                            );
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
                            builder.addInline('<p class="' + 'indent--hanging__' + level + '">' + nextLegalNumber());
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
    });
}
//# sourceMappingURL=app.js.map