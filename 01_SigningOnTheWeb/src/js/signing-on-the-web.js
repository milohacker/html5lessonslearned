/////////////////////////////////
// Create global namespace
var gfx = {};

////////////////////////////////
// Define filters for image processing
// 
// When working with Canvas ImageData, each channel is an 8-bit byte (0-255)
// Pixels are stored in ImageData.data as an array of pixel channels (rgba), this every 4 items in the array equal 1 pixel.
gfx.Filter = {
    desaturate: function(imageData) {
        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            //Create a "gray" value by averaging all three channels
            var gray = (0.21 * data[i] + 0.71 * data[i+1] + 0.07 * data[i+2]);
            
            //Set all three color channels the same to produce a grey
            data[i + 0] = gray; //r
            data[i + 1] = gray; //g
            data[i + 2] = gray; //b
            data[i + 3] = 255;  //alpha
        }

        return imageData;
    },

    multiply: function(imageData) {
        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            data[i + 0] = data[i + 0] * data[i + 0] / 255;
            data[i + 1] = data[i + 1] * data[i + 1] / 255;
            data[i + 2] = data[i + 2] * data[i + 2] / 255;
            data[i + 3] = 255;
        }

        return imageData;
    },

    brightness: function(imageData, brightness) {
        brightness = brightness ? brightness : 1.25; //set default

        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            data[i + 0] = Math.min(255, data[i + 0] * brightness);
            data[i + 1] = Math.min(255, data[i + 1] * brightness);
            data[i + 2] = Math.min(255, data[i + 2] * brightness);
            data[i + 3] = 255;
        }

        return imageData;
    },

    //threshold : required int 0-255 determines which "whites" get knocked out
    //rgb : optional object {r, g, b} will fill each visible pixel
    extract: function(imageData, threshold, rgb) {
        threshold = threshold ? threshold : 200;
        rgb = rgb ? rgb : {r:0, g:67, b:124};

        var data = imageData.data;

        for (var i = 0, length = data.length; i < length; i += 4) {
            //Theshold check against red channel. 
            //This is assuming that the image is greyscale, thus all three channels are the same
            if (data[i] > threshold) { 
                //This pixel is "whiter" than the threshold - make transparent
                data[i + 3] = 0;
            } else {
                //This pixel is visible so fill it with optional rgb, or complete black
                data[i + 0] = rgb ? rgb.r : 0;
                data[i + 1] = rgb ? rgb.g : 0;
                data[i + 2] = rgb ? rgb.b : 0;
                data[i + 3] = 255;
            }
        }

        return imageData;
    },
};




////////////////////////////////
// Define drawing class
// 
gfx.Draw = {
    canvas: null,
    
    points: [],
    isDrawing: false,

    strokeColor: '#0d3d78',
    strokeThickness: 10,
    strokeThicknessMultiplier : 1.35,
    allowVariableThickness: false,
    allowSmoothing: false,

    strokes : new Array(
        {tol:0.350, width:0.81},
        {tol:0.300, width:0.83},
        {tol:0.250, width:0.86},
        {tol:0.200, width:0.9},
        {tol:0.150, width:0.93},
        {tol:0.100, width:0.96},
        {tol:0.095, width:0.99},
        {tol:0.090, width:1.3},
        {tol:0.085, width:1.4},
        {tol:0.080, width:1.6},
        {tol:0.075, width:1.8},
        {tol:0.070, width:1.9},
        {tol:0.065, width:2.1},
        {tol:0.060, width:2.3},
        {tol:0.055, width:2.5},
        {tol:0.050, width:2.7},
        {tol:0.045, width:2.9},
        {tol:0.040, width:3.1},
        {tol:0.035, width:3.3},
        {tol:0.030, width:3.5},
        {tol:0.025, width:3.7},
        {tol:0.020, width:3.9},
        {tol:0.015, width:4.1},
        {tol:0.010, width:4.3},
        {tol:0.005, width:4.5},
        {tol:0.001, width:4.7}
    ),

    initialize: function(canvas) {
        this.canvas = $(canvas);
        this.context = this.canvas.get(0).getContext('2d');

        //Set up all the event handlers
        this.canvas.bind('mousedown', $.proxy(this.eventStart, this));
        this.canvas.bind('mousemove', $.proxy(this.eventMove, this));

        $(document).bind('mouseup', $.proxy(this.eventStop, this)); //bind mouseup on document in case the user releases mouse button away from canvas

        this.clear();
    },

    eventStart: function(event) {
        this.isDrawing = true;

        this.lastX = Math.floor(event.pageX - this.canvas.offset().left);
        this.lastY = Math.floor(event.pageY - this.canvas.offset().top);
        
        this.points.push({x:this.lastX, y:this.lastY});
    },

    eventMove: function(event) {
        if (!this.isDrawing) {
            return;
        }
        
        var x = Math.floor(event.pageX - this.canvas.offset().left);
        var y = Math.floor(event.pageY - this.canvas.offset().top);
        
        var distance = this.distance(this.lastX, this.lastY, x, y) / this.canvas.width();

        this.context.lineWidth = this.allowVariableThickness ? this.calcStrokeWidth(distance) : this.strokeThickness;
        
        this.context.beginPath();
        this.context.moveTo(this.lastX, this.lastY);

        this.context.lineTo(x, y);
        this.context.stroke();
        this.lastX = x;
        this.lastY = y;
        this.points.push({x:this.lastX, y:this.lastY});
        
        
    },

    eventStop: function(event) {
        this.isDrawing = false;
        
        // Quadratic Smoothing only happens when no longer drawing
        if (this.allowSmoothing && this.points.length > 2) {
            this.drawSmoothPath();
        }
    },

    drawSmoothPath: function() {
        this.context.clearRect(0, 0, this.canvas.width(), this.canvas.height());
        this.context.moveTo(this.points[0].x, this.points[0].y); 

        var i = 0;
        for (i = 1; i < this.points.length - 2; i++) {
            var xc = (this.points[i].x + this.points[i + 1].x) / 2;
            var yc = (this.points[i].y + this.points[i + 1].y) / 2;

            this.context.lineWidth = this.strokeThickness;
            this.context.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
        }
        this.context.quadraticCurveTo(this.points[i].x, this.points[i].y, this.points[i + 1].x, this.points[i + 1].y);

        this.context.stroke();
    },
    
    clear: function() {
        if (this.canvas && this.context) {
            this.points = new Array();

            //Reset context and line styles
            this.context.clearRect(0, 0, this.canvas.width(), this.canvas.height());
            this.context.strokeStyle = this.strokeColor;
            this.context.lineCap = "round";
            this.context.lineWidth = this.strokeThickness;
        }
        this.imageData = null;
    },

    calcStrokeWidth: function(distance) {
        if (this.allowSmoothing) {
            return 3;
        }
        var strokeWidth = 3;
        for (var i = 0; i < this.strokes.length; i++) {
            if (distance <= this.strokes[i].tol) {
                strokeWidth = this.strokes[i].width;
            }
        }
        return strokeWidth * this.strokeThicknessMultiplier;
    },
    
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },

    toImage: function() {
        return $('<img src="' + this.canvas.get(0).toDataURL() + '"/>');
    },

    toggleSmooth: function() {
        this.allowSmoothing = !this.allowSmoothing;
    },
    
    toggleVariableThickness: function() {
        this.allowVariableThickness = !this.allowVariableThickness;
    }
};

