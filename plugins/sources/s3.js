'use strict';

var env, s3, stream, util, client, bucket;

env    = require('../../node_modules/image-resizer/src/config/environment_vars');
s3     = require('aws-sdk').S3;
stream = require('stream');
util   = require('util');

try {
  // create an AWS S3 client with the config data
  client = new s3({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION
  });
  bucket = env.S3_BUCKET;
} catch(e) {

}


function s3Stream(image){
  /* jshint validthis:true */
  if (!(this instanceof s3Stream)){
    return new s3Stream(image);
  }
  stream.Readable.call(this, { objectMode : true });
  this.image = image;
  this.ended = false;
  this.readErrorAttemptCount = 0;
}

util.inherits(s3Stream, stream.Readable);

s3Stream.prototype._read = function(){
  var _this = this;

  if ( this.ended ){ return; }

  // pass through if there is an error on the image object
  if (this.image.isError()){
    this.ended = true;
    this.push(this.image);
    return this.push(null);
  }

  // Set the AWS options
  var awsOptions = {
    Bucket: bucket,
    Key: this.image.path.replace(/^\//,'')
  };

  this.image.log.time('s3');

  client.getObject(awsOptions, function(err, data){
    _this.image.log.timeEnd('s3');

    if (err) {
      _this.readErrorAttemptCount += 1;

      // if this is our second loop, accept defeat and error out
      if (_this.readErrorAttemptCount > 1) {
        _this.image.error = new Error(err);
      }
      else {
        // rewrite the path and _read again
        _this.image.path = process.env.IMAGE_404;
        _this._read();
        return;
      }
    }

    // if not store the image buffer
    else {
      _this.image.contents = data.Body;
      _this.image.originalContentLength = data.Body.length;
    }

    _this.ended = true;
    _this.push(_this.image);
    _this.push(null);
  });
};


module.exports = s3Stream;
