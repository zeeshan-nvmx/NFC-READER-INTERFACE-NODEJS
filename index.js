const pcsc = require('pcsclite')

const pcscInstance = pcsc()

pcscInstance.on('reader', (reader) => {
  console.log(`Reader detected: ${reader.name}`)

  if (!reader.name.includes('PICC')) {
    console.log('Ignoring non-PICC reader...')
    return
  }

  reader.on('status', async (status) => {
    console.log(`Reader status changed, current state: ${status.state}`)
    if (status.state & reader.SCARD_STATE_PRESENT) {
      console.log(`Card detected with ATR:`, status.atr.toString('hex'))
      try {
        // Ensure a fresh connection for each scan
        await disconnectReader(reader) // Ensure the reader is disconnected before reconnecting
        const protocol = await connectReader(reader)
        const uid = await transmitToReader(reader, protocol)
        await openUrlWithUid(uid)
      } catch (error) {
        console.error(`An error occurred: ${error}`)
      }
    } else if (status.state & reader.SCARD_STATE_EMPTY) {
      console.log('No card present.')
    }
  })

  reader.on('error', (err) => {
    console.error(`Reader error: ${err.message}`)
  })

  reader.on('end', () => {
    console.log(`Reader removed: ${reader.name}`)
  })
})

async function connectReader(reader) {
  return new Promise((resolve, reject) => {
    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
      if (err) {
        reject(`Connect error: ${err.message}`)
        return
      }
      resolve(protocol)
    })
  })
}

async function disconnectReader(reader) {
  return new Promise((resolve) => {
    reader.disconnect(reader.SCARD_LEAVE_CARD, (err) => {
      if (err) {
        console.log(`Disconnect error: ${err.message}`)
        // Even if there's an error, resolve to try reconnecting
      }
      resolve()
    })
  })
}

async function transmitToReader(reader, protocol) {
  const getUIDCommand = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00])
  return new Promise((resolve, reject) => {
    reader.transmit(getUIDCommand, 255, protocol, (err, data) => {
      if (err) {
        reject(`Transmit error: ${err.message}`)
        return
      }
      const uid = data.slice(0, -2).toString('hex').toUpperCase()
      resolve(uid)
    })
  })
}

async function openUrlWithUid(uid) {
  try {
    const { default: open } = await import('open')
    const baseUrl = 'http://maomao.com/'
    const finalUrl = `${baseUrl}${uid}`
    console.log(`Opening browser to: ${finalUrl}`)
    await open(finalUrl)
  } catch (error) {
    console.error(`Failed to open the browser: ${error}`)
  }
}
