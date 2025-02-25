'use strict';

const parseTorrent = require('parse-torrent');

let parseBittorrentInfo = function (base64TorrentData) {
    const torrentData = Buffer.from(base64TorrentData, 'base64');
    const torrentInfo = parseTorrent(torrentData);

    return {
        name: torrentInfo.name,
        private: torrentInfo.private,
        length: torrentInfo.length,
        pieceLength: torrentInfo.pieceLength,
        lastPieceLength: torrentInfo.lastPieceLength,
        created: torrentInfo.created,
        infoHash: torrentInfo.infoHash,
        comment: torrentInfo.comment,
        files: torrentInfo.files
    };
};

module.exports = {
    parseBittorrentInfo: parseBittorrentInfo
};
