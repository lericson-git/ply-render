//PLY PARSER

var binr, textr;
var binFile, textData;
var vertexData, rgbData;
var numVertices, numFaces;
var hasColors, hasFaces;
var format, version;

var effects = {
    implode: false,
    jiggle: false,
    fall: false,
    explode: false,
    dissolve: false
}

var effectsProperties = {
    implode: 0.025,
    jiggle: 50/700,
    fall: 0.01,
    explode: 0.01,
    dissolve: 0.01
}

clearEffects = function() {
    for (const key in effects) {
        effects[key] = false;
    }
    modifiedVerticies = [];
    effectsProperties.explode = 0.01;

    let rescale = Math.abs(1 / totalChange);
    model.premultiply(new THREE.Matrix4().makeScale(rescale, rescale, rescale));
    totalChange = 1;
}

var lowestYCoord = Number.MAX_SAFE_INTEGER;
var verticesPercent = 1;

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    console.log(displayWidth, displayHeight, canvas.width, canvas.height);

    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }

    return needResize;
}

setFile = function(file) {
    console.log("Beginning plyParser.setFile...");

    if (file) {
        // var binr = new FileReader(file);
        var textr = new FileReader(file);

        //Get binary file
        // binr.readAsArrayBuffer(file);
        // binr.onload = function() {
        //     console.log("Binary file loaded", binr.readyState);
        //     console.log("Result: ", binr.result);

        //     binFile = new Uint8Array(binr.result);
        // }

        //Get text file for header
        textr.readAsText(file);
        textr.onload = function() {
            console.log("Text file loaded", textr.readyState);
            //console.log("Result: ", textr.result);
            textData = textr.result;
            parseHeader();
        }

    } else {
        console.error("Failed to load file");
    }

    console.log("Finished plyParser.setFile!");
}

parseHeader = function() {
    console.log("Starting plyParser.parseHeader...");

    //Read header
    var curVal, newline, line;
    //var hasNormals = false;
    //text = String(text);

    //console.log("TEXT DATA: " + textData);

    while(textData.length) {
        newline = textData.indexOf("\n") + 1;
        line = textData.substring(0, newline - 1).trim();
        textData = textData.substring(newline);

        //Get format
        curVal = textData.match(/format (\w+) (\d+)\.(\d+)/);
        if(curVal) {
            format = curVal[1];
            version = curVal[2];
        }

        //Get elements
        curVal = textData.match(/element (\w+) (\d+)/); //find first element line
        if(curVal) {
            if(curVal[1] == "vertex") numVertices = parseInt(curVal[2]);
            if(curVal[1] == "face") {
                numFaces = parseInt(curVal[2]);
                hasFaces = true;
            }
        }

        //Get properties
        curVal = textData.match(/property (\w+) (\w+)/);
        if(curVal) {
            if(curVal[2] == "red" || curVal[2] == "green" || curVal[2] == "blue") {
                hasColors = true;
            }
        }

        //if(line == "property float nx") hasNormals = true;
        if(line == "end_header") break;
    }

    console.log("Format: " + format);
    console.log("Version: " + version);
    console.log("Number of vertices: " + numVertices);
    console.log("Number of faces" + numFaces);
    console.log("Has colors? " + hasColors);

    console.log("Finished plyParser.parseHeader!");
    parseAscii();
}

var verticies = []
var rgbTexture = []
var modifiedVerticies = []
var adjustedVerticiesAmount = 0;

percentScaledFunction = function (percent) {
    return Math.pow(200, percent - 1)
}

formArrayFromSegmentedBuffer = function(buf, vertAmounts, sizeOfSublist) {
    var amtVertsCalculatedReduced = Math.ceil(vertAmounts * percentScaledFunction(verticesPercent));
    var step = Math.ceil(vertAmounts / amtVertsCalculatedReduced);
    adjustedVerticiesAmount = Math.floor(vertAmounts / step)
    var arr = new Float32Array(adjustedVerticiesAmount * sizeOfSublist);

    var counter = 0;

    buf.forEach((vert, index) => {
        if (index % step === 0) {
            vert.forEach(coord => {
                arr[counter] = coord;
                counter++;
            })
        }
    })

    return arr;
}

parseAscii = function() {
    if(format === "ascii") {

        modifiedVerticies = [];
        verticies = [];
        rgbTexture = [];
        lowestYCoord = Number.MAX_SAFE_INTEGER;

        var curVal, newline, line;

        for(let i = 0; i < numVertices; i++) {
            newline = textData.indexOf("\n") + 1;
            line = textData.substring(0, newline - 1).trim();
            textData = textData.substring(newline);

            curVal = line.split(" ");

            var vertexInfoCurrent = [parseFloat(curVal[0]), parseFloat(curVal[1]), parseFloat(curVal[2])];
            verticies.push(vertexInfoCurrent)

            var rgbTextureCurrent = [parseInt(curVal[6]) / 255.0, parseInt(curVal[7]) / 255.0, parseInt(curVal[8]) / 255.0, parseInt(curVal[9]) / 255.0]
            rgbTexture.push(rgbTextureCurrent)

        }

        vertexData = formArrayFromSegmentedBuffer(verticies, numVertices,3);
        rgbData = formArrayFromSegmentedBuffer(rgbTexture, numVertices,4);

        vertexBuffer = createAndLoadBuffer(vertexData);
        vertexColorBuffer = createAndLoadBuffer(rgbData);

    }
}


// vertex shader
const vshaderSource = `
uniform mat4 transform;
uniform float pointSize;
attribute vec4 a_Position;
attribute vec4 a_Color;
varying vec4 color;
void main()
{
  color = a_Color;
  gl_Position = transform * a_Position;
  gl_PointSize = pointSize;
}
`;

// fragment shader
const fshaderSource = `
precision mediump float;
varying vec4 color;
void main()
{
  gl_FragColor = color;
}
`;

var axisVertices = new Float32Array([
0.0, 0.0, 0.0,
1.5, 0.0, 0.0,
0.0, 0.0, 0.0,
0.0, 1.5, 0.0,
0.0, 0.0, 0.0,
0.0, 0.0, 1.5]);

var axisColors = new Float32Array([
1.0, 0.0, 0.0, 1.0,
1.0, 0.0, 0.0, 1.0,
0.0, 1.0, 0.0, 1.0,
0.0, 1.0, 0.0, 1.0,
0.0, 0.0, 1.0, 1.0,
0.0, 0.0, 1.0, 1.0]);

// A few global variables...

// the OpenGL context
var gl;

// handle to a buffer on the GPU
var vertexBuffer;
var vertexColorBuffer;
var indexBuffer;
var axisBuffer;
var axisColorBuffer;

// handle to the compiled shader program on the GPU
var shader;

// transformation matrices
var model = new THREE.Matrix4();

//view matrix
var view;

// Approximate view point (1.77, 3.54, 3.06) corresponds to the view
// matrix described above
view = createLookAtMatrix(
               new THREE.Vector3(1.77, 3.54, 3.06),   // eye
               new THREE.Vector3(0.0, 0.0, 0.0),      // at - looking at the origin
               new THREE.Vector3(0.0, 1.0, 0.0));    // up vector - y axis


// Using a perspective matrix
var projection;

// try the same numbers as before, with aspect ratio 1.5

// projection = new THREE.Matrix4().makePerspective(-1.5, 1.5, 1, -1, 4, 6);

var projLeft = -1.5, projRight = 1.5, projTop = 1, projBot = -1;
var projNear = 4;
var projFar = 6;

projection = new THREE.Matrix4().makePerspective(projLeft, projRight, projTop, projBot, projNear, projFar);

var axis = 'y';
var paused = false;

var pointSize = 5.0;


//translate keypress events to strings
//from http://javascript.info/tutorial/keyboard-events
function getChar(event) {
    if (event.which == null) {
        return String.fromCharCode(event.keyCode) // IE
    } else if (event.which!=0 && event.charCode!=0) {
        return String.fromCharCode(event.which)   // the rest
    } else {
        return null // special key
    }
}

//handler for key press events will choose which axis to
// rotate around
function handleKeyPress(event)
{
	var ch = getChar(event);
	switch(ch) {
        // rotation controls
        case ' ':
            paused = !paused;
            break;
        case 'x':
            model.premultiply(new THREE.Matrix4().makeRotationX(toRadians(90)));
            axis = 'x';
            break;
        case 'y':
            model.premultiply(new THREE.Matrix4().makeRotationY(toRadians(90)));
            axis = 'y';
            break;
        case 'z':
            model.premultiply(new THREE.Matrix4().makeRotationZ(toRadians(90)));
            axis = 'z';
            break;
        case 'o':
            model.identity();
            axis = 'x';
            break;
        case 'w':
            view.premultiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0))
            break;
        case 'a':
            view.premultiply(new THREE.Matrix4().makeTranslation(0.05, 0, 0))
            break;
        case 's':
            view.premultiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0))
            break;
        case 'd':
            view.premultiply(new THREE.Matrix4().makeTranslation(-0.05, 0, 0))
            break;
        case 'i':
            view.premultiply(new THREE.Matrix4().makeRotationX(toRadians(-0.5)))
            break;
        case 'k':
            view.premultiply(new THREE.Matrix4().makeRotationX(toRadians(0.5)))
            break;
        case 'j':
            view.premultiply(new THREE.Matrix4().makeRotationY(toRadians(-0.5)))
            break;
        case 'l':
            view.premultiply(new THREE.Matrix4().makeRotationY(toRadians(0.5)))
            break;

	}
}

// code to actually render our geometry
function draw()
{
    resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // clear the framebuffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BIT);

    // bind the shader
    gl.useProgram(shader);

    // get the index for the a_Position attribute defined in the vertex shader
    var positionIndex = gl.getAttribLocation(shader, 'a_Position');
    if (positionIndex < 0) {
        console.log('Failed to get the storage location of a_Position');
        return;
    }

    var colorIndex = gl.getAttribLocation(shader, 'a_Color');
    if (colorIndex < 0) {
        console.log('Failed to get the storage location of a_');
        return;
    }

    // "enable" the a_position attribute
    gl.enableVertexAttribArray(positionIndex);
    gl.enableVertexAttribArray(colorIndex);

    if (modifiedVerticies.length == 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, createAndLoadBuffer(formArrayFromSegmentedBuffer(verticies, numVertices, 3)));
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, createAndLoadBuffer(formArrayFromSegmentedBuffer(modifiedVerticies, numVertices, 3)));
    }
    // bind buffers for points

    gl.vertexAttribPointer(positionIndex, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, createAndLoadBuffer(formArrayFromSegmentedBuffer(rgbTexture, numVertices, 4)));
    gl.vertexAttribPointer(colorIndex, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // set uniform in shader for projection * view * model transformation
    var transform = new THREE.Matrix4().multiply(projection).multiply(view).multiply(model);
    var transformLoc = gl.getUniformLocation(shader, "transform");
    gl.uniformMatrix4fv(transformLoc, false, transform.elements);

    //Set point size uniform
    var pointLoc = gl.getUniformLocation(shader, "pointSize");
    gl.uniform1f(pointLoc, pointSize);

    gl.drawArrays(gl.POINTS, 0, adjustedVerticiesAmount);

    // draw axes (not transformed by model transformation)
    gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
    gl.vertexAttribPointer(positionIndex, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, axisColorBuffer);
    gl.vertexAttribPointer(colorIndex, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // set transformation to projection * view only
    transform = new THREE.Matrix4().multiply(projection).multiply(view);
    gl.uniformMatrix4fv(transformLoc, false, transform.elements);

    // draw axes
    gl.drawArrays(gl.LINES, 0, 6);

    // unbind shader and "disable" the attribute indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.disableVertexAttribArray(positionIndex);
    gl.disableVertexAttribArray(colorIndex);
    gl.useProgram(null);
}

var totalChange = 1;

// entry point when page is loaded
window.onload = function main() {

    //Make sure browser can support files
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        //Get file from document and pass it to parser
        var fileElement = document.getElementById('fileinput');

        //All parser code should go in the onchange event handler
        fileElement.onchange = function() {
            selectedFile = fileElement.files[0];
            setFile(selectedFile); //I chained all the parsing methods into this one
            
        }
    } else {
        console.error('The File APIs are not fully supported by your browser.');
    }

    // get graphics context
    gl = getGraphicsContext("theCanvas");
    resizeCanvasToDisplaySize(gl.canvas);

    // key handlers
    window.onkeypress = handleKeyPress;

    // load and compile the shader pair
    shader = createShaderProgram(gl, vshaderSource, fshaderSource);

    // load the vertex data into GPU memory
    vertexBuffer = createAndLoadBuffer(vertexData);
    vertexColorBuffer = createAndLoadBuffer(rgbData);

    // axes
    axisBuffer = createAndLoadBuffer(axisVertices);
    axisColorBuffer = createAndLoadBuffer(axisColors);

    gl.clearColor(0.9, 0.9, 0.9, 1.0);

    gl.enable(gl.DEPTH_TEST);

    document.addEventListener( 'mousewheel', (event) => {
        let change = -event.deltaY/1000 + 1;
        //view.premultiply(new THREE.Matrix4().makeTranslation(0, 0, change));
        model.premultiply(new THREE.Matrix4().makeScale(change, change, change));
        totalChange *= change;
    });

    var vertSlider = document.getElementById("verticesSlider")
    vertSlider.addEventListener("change", function() {
        verticesPercent = vertSlider.value / 100.0;
        draw()
    })

    const clone = (items) => items.map(item => Array.isArray(item) ? clone(item) : item);

    function generateRandomJiggle(pointVal, jiggleScale) {

        var min = -jiggleScale * pointVal
        var max = jiggleScale * pointVal

        return Math.random() * (max - min) + min
    }


    // var directions;
    // function setupDissolve() {
    //     directions = [];
    //     for (var i = 0; i < modifiedVerticies.length; i++) {
    //         let max = -2;
    //         directions[i] = Math.floor(Math.random() * 4);
    //         // console.log(modifiedVerticies[i]);
    //         // for (var j = 0; j < 3; j++) {
    //         //     // max = Math.max(modifiedVerticies[i][j], max);

    //         //     if(max < modifiedVerticies[i][j]) {
    //         //         directions[i] = j;
    //         //         max = modifiedVerticies[i][j];
    //         //     }
    //         // }
    //     }
    //     console.log(directions);
    //     return directions;
    // }

    // define an animation loop
    var animate = function() {

        if (modifiedVerticies.length === 0) {
            modifiedVerticies = clone(verticies)

            modifiedVerticies.forEach((vert) => {
                if (vert[2] < lowestYCoord) {
                    lowestYCoord = vert[2];
                }
            })
        }

        if (effects.jiggle) {
            for (var i = 0; i < modifiedVerticies.length; i++) {
                for (var j = 0; j < 3; j++) {
                    modifiedVerticies[i][j] = verticies[i][j] + generateRandomJiggle(modifiedVerticies[i][j], effectsProperties.jiggle)
                }
            }
        }

        if (effects.fall) {
            for (var i = 0; i < modifiedVerticies.length; i++) {
                modifiedVerticies[i][2] = Math.max(modifiedVerticies[i][2] - effectsProperties.fall, lowestYCoord);
            }
        }

        if (effects.implode) {
            for (var i = 0; i < modifiedVerticies.length; i++) {
                for (var j = 0; j < 3; j++) {
                    modifiedVerticies[i][j] = modifiedVerticies[i][j] * (1 - effectsProperties.implode);
                }
            }
        }

        if (effects.explode) {
            for (var i = 0; i < modifiedVerticies.length; i++) {
                let dir = Math.floor(Math.random() * 5) - 2;
                let sign = Math.floor(Math.random() * 3) - 1;
                modifiedVerticies[i][dir] += effectsProperties.explode * sign;
            }
            effectsProperties.explode *= 1.1;
        }

        if (effects.dissolve) {
            let dissolveSpeed = (((effectsProperties.dissolve) * (modifiedVerticies.length - modifiedVerticies.length / 200)) / 100 + modifiedVerticies.length / 200);
            for (var i = 0; i < dissolveSpeed; i++) {
                let val = Math.floor(Math.random() * modifiedVerticies.length);
                modifiedVerticies[val][0] += 5;
            }
            //effectsProperties.dissolve *= 2;


            //move particle in dir based on how far it is from origin
        }

        //vertexData = formArrayFromSegmentedBuffer(verticies, numVertices,3);

	    draw();

        if (!paused) {
            // "extrinsic" coordinate axis rotations
            switch(axis) {
                case 'x':
                    model.premultiply(new THREE.Matrix4().makeRotationX(toRadians(1)));
                    break;
                case 'y':
                    model.premultiply(new THREE.Matrix4().makeRotationY(toRadians(1)));
                    break;
                case 'z':
                    model.premultiply(new THREE.Matrix4().makeRotationZ(toRadians(1)));
                    break;
                default:
            }
        }

        // request that the browser calls animate() again "as soon as it can"
        requestAnimationFrame(animate);
    };

    model.premultiply(new THREE.Matrix4().makeRotationX(toRadians(270)));

    animate();
}
