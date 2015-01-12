# Tube-n-tastic!

Browser based home entertainment center (HEC) running on HTTP.

![Tube thumbnail](thumbnail.png)

**Future Plans**
* Add a file/folder table system for SQL in RAM only
* File search: when you press enter in the search textbox, add all highlighted to playlist
* Find out how to support more video and audio file formats!
* Connect via HTTP to HEC using mobile phone to act as a remote, Examples:
	* Adjust volume / pause, even when you are not in the same room
	* Append to playlist

## TECHNOLOGIES

**NodeJS**

	Express, ShortId, Mime

**JavaScript**

	jQuery, jQuery UI, video.js, jstree

## MIME SUPPORT

	"video/mp4", "video/webm", "video/ogg", "video/ogv"

## INSTALL

**NodeJS**

```
> sudo apt-get update
> sudo apt-get install build-essential
> sudo apt-get install nodejs
> sudo apt-get install npm
```

**NodeJS Plugins**

```
> npm install shortid
> npm install mime
> npm install express
```

## RUN

```
> nodejs tube.js <port>
```

**Note:** port is optional and defaults to 8080

## LOAD

Store your videos in *./www/videos*
