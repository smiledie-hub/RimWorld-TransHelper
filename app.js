#!/usr/bin/env node

const commander = require('commander'),
    xml2js = require('xml2js'),
    fs = require('fs'),
    translate = require('@k3rn31p4nic/google-translate-api'),
    clear = require('clear'),
    chalk = require('chalk'),
    figlet = require('figlet')

const parser = new xml2js.Parser()
const builder = new xml2js.Builder()

clear()
console.log(
    chalk.yellow(
        figlet.textSync('RimWorld-TransHelper', {horizontalLayout: 'full'})
    )
)

commander
    .version('0.0.3')
    .description(
        chalk.green('RimWorld-TransHelper')
    )

commander.command('translate <file>')
    .option('--to <value>', 'What language to translate into')
    .option('--from <value>', 'What language to translate from')
    .option('--output', 'Output the finished file to the console')
    .option('--fix-line-breaks', 'Correct curves translated line breaks \\n')
    .description(chalk.green(
        'Translating an xml file from one language to another')
    )
    .action((patch, cmd) => {

        let _from = cmd.from || "auto",
            _to = cmd.to || "ru"

        fs.readFile(patch, function (err, data) {
            parser.parseString(data, async (err, result) => {

                console.info("Reading a file...")

                if (result["LanguageData"]) {

                    for (let key in result["LanguageData"]) {
                        if (result["LanguageData"][key].length > 0) {

                            const arrStrings = []

                            for (let i = 0; i < result["LanguageData"][key].length; i++) {
                                let translation = await translate(result["LanguageData"][key][i], {
                                    from: _from,
                                    to: _to
                                })

                                if(cmd["fix-line-breaks"]) translation.text = translation.text.replace(/ {0,3}\\.{0,2}n {0,3}/gmi, "\\n")

                                arrStrings.push(translation.text)
                                console.info(chalk.green(`\nTranslate string complete.\n`), chalk.grey(`From: ${key} - ${result["LanguageData"][key][i]}\n`), chalk.white(`To: ${key} - ${translation.text}`))
                            }

                            result["LanguageData"][key] = arrStrings
                        } else {
                            console.warn(`Warning: ${result["LanguageData"][key]} - irrelevant`)
                        }
                    }

                    let writeXML = builder.buildObject(result)
                    fs.writeFile(patch, writeXML, function (err) {
                        if (err) console.error(err)
                        else console.info(chalk.bold(chalk.green(`\n\nTranslation successful.\n\nFile ${patch} was translated from: ${_from}, on the ${_to}`)), cmd.output ? chalk.white(`\n\nOutput:\n${writeXML}`) : '')

                    })
                } else {
                    console.error(`Invalid file format: Missing "LanguageData" line`)
                }
            })
        })
    })

commander.parse(process.argv)
