export default class S3Adapter {
	constructor( loader, url, mapUrl, modelId, modelType ) {
		this.loader = loader;
		this.url = url;
		this.mapUrl = mapUrl || ( ( { location } ) => location );
		this.file = undefined;
		this.path = undefined;
		this.uploadedUrl = undefined;
		this.modelId = modelId;
		this.modelType = modelType;
	}

	upload() {
		return this.getCredentials().then( this.uploadImage.bind( this ) );
	}

	abort() {
		if ( this.xhr ) {
			this.xhr.abort();
		}
	}

	getCredentials() {
		return new Promise( async ( resolve, reject ) => {
			this.file = await this.loader.file;
			const filename = this.file.name;

			if ( !filename ) {
				return reject( 'No filename found' );
			}

			const xhr = new XMLHttpRequest(); // eslint-disable-line no-undef

			xhr.withCredentials = true;
			xhr.open( 'POST', this.url +
				`?filename=${ filename }&model_id=${ this.modelId || '' }&model_type=${ this.modelType || '' }`, true );
			xhr.responseType = 'json';
			xhr.setRequestHeader( 'Content-Type', 'application/json' );

			xhr.addEventListener( 'error', () => reject( 'crederr' ) );
			xhr.addEventListener( 'abort', () => reject( 'credabort' ) );
			xhr.addEventListener( 'load', function() {
				const res = xhr.response;

				if ( !res ) {
					return reject( 'No response from s3 creds url' );
				}

				resolve( res );
			} );

			xhr.send();
		} );
	}

	uploadImage( s3creds ) {
		return new Promise( ( resolve, reject ) => {
			const data = new FormData(); // eslint-disable-line no-undef

			for ( const param in s3creds.params ) {
				if ( !s3creds.params.hasOwnProperty( param ) ) {
					continue;
				}

				data.append( param, s3creds.params[ param ] );
			}

			data.append( 'Content-Type', this.file.type );

			data.append( 'file', this.file );

			const xhr = this.xhr = new XMLHttpRequest(); // eslint-disable-line no-undef

			xhr.withCredentials = false;
			xhr.responseType = 'json';

			this.path = s3creds.params.key.replace( '${filename}', this.file.name );
			this.uploadedUrl = `${ s3creds.endpoint_url }/${ this.path }`;

			xhr.addEventListener( 'error', () => reject( 's3err' ) );
			xhr.addEventListener( 'abort', () => reject( 's3abort' ) );
			xhr.addEventListener( 'load', () => {
				if ( xhr.status !== 204 ) {
					return reject( 'There was a problem uploading the file.' );
				}

				resolve( { default: this.mapUrl( { location: this.uploadedUrl, file: this.file, path: this.path } ) } );
			} );

			if ( xhr.upload ) {
				xhr.upload.addEventListener( 'progress', e => {
					if ( !e.lengthComputable ) {
						return;
					}

					this.loader.uploadTotal = e.total;
					this.loader.uploaded = e.loaded;
				} );
			}

			xhr.open( 'POST', s3creds.endpoint_url, true );
			xhr.send( data );
		} );
	}
}
