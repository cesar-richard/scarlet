# scarlet
[![Build Status](https://travis-ci.com/cesar-richard/scarlet.svg?branch=master)](https://travis-ci.com/cesar-richard/scarlet) 
[![Maintainability](https://api.codeclimate.com/v1/badges/add2cd9a14931371621d/maintainability)](https://codeclimate.com/github/cesar-richard/scarlet/maintainability)
[![codecov](https://codecov.io/gh/cesar-richard/scarlet/branch/master/graph/badge.svg)](https://codecov.io/gh/cesar-richard/scarlet)

Interface between physic devices (like ACR122U NFC Reader) and websockets subscribers (like React apps)

Binaries availiable at :

| OS      | Binary                                                                                               |
|:-------:|:----------------------------------------------------------------------------------------------------:|
| Windows | [scarlet-win.exe](https://github.com/cesar-richard/scarlet/releases/latest/download/scarlet-win.exe) |
| MacOS   | [scarlet-macos](https://github.com/cesar-richard/scarlet/releases/latest/download/scarlet-macos)     |
| Linux   | [scarlet-linux](https://github.com/cesar-richard/scarlet/releases/latest/download/scarlet-linux)     |


## Troubleshooting

There's a known issue with npm & python setup on Windows. Ensure thath Python in installed and if it still doesn't want to compile try:

``` npm --add-python-to-path='true' --debug install --global windows-build-tools ```
