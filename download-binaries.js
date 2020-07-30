#!/usr/bin/env node

/**
 * Download latest release of Move Language Server for user's OS
 * @module move-ls-loader
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PLATFORM = process.env.PLATFORM || process.platform;

['move-ls', 'move-build', 'move-executor'].map(function (binName) {

    const cfg = require('./package.json')[binName];
    const bin = cfg.binaries[PLATFORM];
    const url = `https://github.com/${cfg.repository}/releases/download/${cfg.version}/${bin}`;
    const tgt = (PLATFORM === 'win32') && (binName + '.exe') || binName;

    if (bin !== null) {
        https.get(url, (res) => {
            https.get(res.headers.location, (res) => {
                console.log('Downloading file from %s', url);
                res.pipe(fs.createWriteStream(path.resolve('bin/' + tgt), {mode: '755'}));
            });
        });
    }
});


