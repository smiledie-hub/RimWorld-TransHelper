const xml2js = require('xml2js')
const {program} = require('commander')
const path = require("path")
const fs = require('fs')
const builder = require('xmlbuilder')

program.version('0.0.1')

const parser = new xml2js.Parser()

const localDirMods = path.resolve(__dirname, 'mods')
const dirMods = path.normalize('C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\294100')
const mods = []

function createNewModTranslate(original, pathOriginal) {
    const nameOriginal = original['ModMetaData'].name[0]
    const name = `${nameOriginal} [RU version]`
    const author = 'SmileDie'
    const description = 'Авто перевод мода на русский язык'
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
        const modDir = path.resolve(localDirMods, name)
        const modDirAbout = path.resolve(modDir, 'About')
        const modDirAboutFile = path.resolve(modDirAbout, 'About.xml')

        if (!fs.existsSync(modDir))
            fs.mkdirSync(modDir)

        if (!fs.existsSync(modDirAbout))
            fs.mkdirSync(modDirAbout)

        if (!fs.existsSync(modDirAboutFile))
            fs.writeFileSync(modDirAboutFile, xml)

        const files = fs.readdirSync(path.resolve(pathOriginal, 'About'))
        for (const file of files) {
            if(file.toLowerCase() === 'preview.png') {
                const inPreview = path.resolve(pathOriginal, 'About', file)
                const outPreview = path.resolve(modDirAbout, 'preview.png')

                fs.copyFileSync(inPreview, outPreview)
            }
        }

    } catch (e) {}
}

async function runTranslate(source) {
    if (!fs.existsSync(localDirMods)) {
        fs.mkdirSync(localDirMods)
    }

    const dirs = fs.readdirSync(dirMods)

    for (const dir of dirs) {
        const dirsMode = path.join(dirMods, dir, 'Languages')

        const isExist = fs.existsSync(dirsMode)
        if (isExist) {
            const dirLangModUs = path.join(dirsMode, 'English')
            const dirLangModRu = path.join(dirsMode, 'Russian')

            const isExistLangRu = fs.existsSync(dirLangModRu)
            if (!isExistLangRu) {
                const isExistLangUs = fs.existsSync(dirLangModUs)
                if (isExistLangUs) {
                    mods.push(dir)
                }
            }
        }
    }

    for (const mod of mods) {
        const modAboutPath = path.join(dirMods, mod, 'About', 'About.xml')
        const isModAbout = fs.existsSync(modAboutPath)

        if (isModAbout) {
            fs.readFile(modAboutPath, function (err, data) {
                parser.parseString(data, async (err, result) => {
                    createNewModTranslate(result, path.join(dirMods, mod))
                })
            })
        }
    }
}

program
    .command('translate <source>')
    .action(runTranslate)

program.parse(process.argv)