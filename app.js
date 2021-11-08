const xml2js = require('xml2js')
const {program} = require('commander')
const path = require("path")
const fs = require('fs')
const builder = require('xmlbuilder')
const Jimp = require('jimp')
const fse = require('fs-extra')
const translate = require('@vitalets/google-translate-api')

program.version('0.0.1')

const parser = new xml2js.Parser()
const builderXml2js = new xml2js.Builder()

const localDirMods = path.resolve(__dirname, 'mods')
let dirMods = undefined
const mods = []
const dirsLang = ['English', 'French']

function getFiles(dir) {
    const dirents = fs.readdirSync(dir, {withFileTypes: true})
    const files = dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFiles(res) : res
    })
    return Array.prototype.concat(...files)
}

async function translateModes(dir) {
    const options = program.opts();
    const isTranslate = program.args.indexOf('--no-translate') === -1
    if(isTranslate) {
        const files = getFiles(dir)
        for (const file of files) {
            const fileData = fs.readFileSync(file)

            parser.parseString(fileData, async (err, result) => {
                if (result["LanguageData"]) {
                    for (let key in result["LanguageData"]) {
                        const data = result["LanguageData"][key]
                        if (data.length > 0) {
                            const arrStrings = []

                            try {
                                for (let i = 0; i < data.length; i++) {
                                    let translation = await translate(result["LanguageData"][key][i], {
                                        to: 'ru'
                                    })

                                    arrStrings.push(translation.text)
                                    translation.text = translation.text.replace(/ {0,3}\\.{0,2}n {0,3}/gmi, "\\n")
                                }
                            } catch (e) {
                                console.error(e)
                            }
                            result["LanguageData"][key] = arrStrings
                        }
                    }

                    let writeXML = builderXml2js.buildObject(result)
                    fs.writeFileSync(file, writeXML)

                    console.log(`Файл ${file} переведён`)
                }
            })
        }
    }
}

async function createNewModTranslate(original, pathOriginal, langPath) {
    const nameOriginal = original['ModMetaData'].name[0]
    const name = `${nameOriginal} [RU translate]`
    const author = 'SmileDie'
    const description = `Машинный автоматический перевод ${nameOriginal} на русский язык.`
    const packageIdOriginal = original['ModMetaData']['packageId'][0]
    const packageIdOriginalName = packageIdOriginal.split('.')[1]
    const packageId = `SmileDie.${packageIdOriginalName}Ru`
    const supportedVersionsOriginal = original['ModMetaData']['supportedVersions'][0]
    const supportedVersions = supportedVersionsOriginal.li.map(item => {
        return {
            '#text': item,
        }
    })
    const loadAfter = {
        loadAfter: {
            li: {
                '#text': packageIdOriginal,
            }
        }
    }
    const steamWorkshopUrl = `https://steamcommunity.com/workshop/filedetails/?id=${path.parse(pathOriginal).base}`
    const xmlObj = {
        ModMetaData: {
            name: {
                '#text': name,
            },
            author: {
                '#text': author,
            },
            description: {
                '#text': description,
            },
            packageId: {
                '#text': packageId,
            },
            modDependencies: [
                {
                    li: {
                        packageId: {
                            '#text': packageIdOriginal,
                        },
                        displayName: {
                            '#text': nameOriginal,
                        },
                        steamWorkshopUrl: {
                            '#text': steamWorkshopUrl
                        }
                    }
                }
            ],
            supportedVersions: {
                li: supportedVersions
            },
            ...loadAfter
        }
    }

    const xml = builder.create(xmlObj)
        .end({pretty: true});

    try {
        const modDir = path.normalize(path.resolve(localDirMods, path.parse(pathOriginal).base))
        const modLangDir = path.resolve(modDir, 'Languages')
        const modDirAbout = path.resolve(modDir, 'About')
        const modDirAboutFile = path.resolve(modDirAbout, 'About.xml')

        fse.mkdirpSync(modDir)
        fse.mkdirpSync(modDirAbout)
        fse.mkdirpSync(modLangDir)

        if (!fs.existsSync(modDirAboutFile))
            fs.writeFileSync(modDirAboutFile, xml)

        const files = fs.readdirSync(path.resolve(pathOriginal, 'About'))
        for (const file of files) {
            if (file.toLowerCase() === 'preview.png') {
                const inPreview = path.resolve(pathOriginal, 'About', file)
                const outPreview = path.resolve(modDirAbout, 'preview.png')

                fs.copyFileSync(inPreview, outPreview)

                Jimp.read(outPreview)
                    .then(image => {
                        Jimp.read(path.resolve(__dirname, 'image', 'ru.png')).then(imageFlag => {
                            image.resize(640, Jimp.AUTO)
                            imageFlag.resize(140, Jimp.AUTO)
                            image.composite(imageFlag, 30, image.getHeight() - imageFlag.getHeight() - 30, {
                                opacitySource: 0.9,
                                opacityDest: 0.9
                            })
                            image.write(outPreview)
                        }).catch(err => {
                            console.log(err)
                        })
                    })
                    .catch(err => {
                        console.log(err)
                    })
            }
        }

        fse.copySync(langPath, path.resolve(modLangDir, 'Russian'));
        await translateModes(path.resolve(modDir, 'Languages', 'Russian'))
    } catch (e) {
        console.error(e)
    }
}

function runTranslate(source) {
    fse.removeSync(localDirMods)
    fse.mkdirpSync(localDirMods)

    dirMods = path.normalize(source)
    const dirs = fs.readdirSync(dirMods)

    for (const dir of dirs) {
        const dirsMode = path.join(dirMods, dir, 'Languages')

        const isExist = fs.existsSync(dirsMode)
        const isExistRu = fs.existsSync(path.resolve(dirsMode, 'Russian'))

        if (!isExistRu && isExist) {
            for (const lang of dirsLang) {
                const dirLangMod = path.join(dirsMode, lang)
                const isExistLang = fs.existsSync(dirLangMod)

                if (isExistLang) {
                    mods.push({
                        dir: dir,
                        langDir: dirLangMod
                    })
                    break
                }
            }
        }
    }

    for (const mod of mods) {
        const modAboutPath = path.join(dirMods, mod.dir, 'About', 'About.xml')
        const isModAbout = fs.existsSync(modAboutPath)

        if (isModAbout) {
            fs.readFile(modAboutPath, function (err, data) {
                parser.parseString(data, async (err, result) => {
                    createNewModTranslate(result, path.join(dirMods, mod.dir), mod.langDir).catch(e => console.error(e))
                })
            })
        }
    }
}

program
    .command('translate <source>')
    .option('--no-translate')
    .action(runTranslate)

program.parse(process.argv)