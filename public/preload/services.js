const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const https = require('node:https')

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  // 读文件
  readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  // 文本写入到下载目录
  writeTextFile (text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  // 图片写入到下载目录
  writeImageFile (base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  },
  // 写文本到指定路径
  writeTextToPath (text, savePath) {
    const dir = path.dirname(savePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(savePath, text, { encoding: 'utf-8' })
    return savePath
  },
  // 下载文件到指定路径（返回 Promise）
  downloadFile (url, savePath) {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const client = url.startsWith('https') ? https : http
      client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // 跟随重定向
          window.services.downloadFile(res.headers.location, savePath).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败，状态码: ${res.statusCode}`))
          return
        }
        const fileStream = fs.createWriteStream(savePath)
        res.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve(savePath)
        })
        fileStream.on('error', (err) => {
          fs.unlink(savePath, () => {})
          reject(err)
        })
      }).on('error', reject)
    })
  },
  // 暴露 path.join
  pathJoin (...args) {
    return path.join(...args)
  },
  // 获取默认下载目录
  getDownloadsPath () {
    return window.utools.getPath('downloads')
  },
  // 检查目录是否存在
  dirExists (dirPath) {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
  }
}
