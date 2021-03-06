//
//  RDPackageResource.h
//  SDKLauncher-iOS
//
//  Created by Shane Meyer on 2/28/13.
// Modified by Daniel Weck
//  Copyright (c) 2012-2013 The Readium Foundation.
//

#import <Foundation/Foundation.h>
#import <ePub3/utilities/byte_stream.h>

#define kSDKLauncherPackageResourceBufferSize 4096

@class RDPackageResource;
@class LOXPackage;

@interface RDPackageResource : NSObject {
}

//@property (nonatomic, readonly) ePub3::ByteStream* byteStream;
@property (nonatomic, readonly) std::size_t bytesCount;

// The content of the resource in its entirety.  If you call this, don't call
// createNextChunkByReading.
//@property (nonatomic, readonly) NSData *data;

// The relative path associated with this resource.
@property (nonatomic, readonly) NSString *relativePath;

// The next chunk of data for the resource, or nil if we have finished reading all chunks.  If
// you call this, don't call the data property.
- (NSData *)createNextChunkByReading;

- (NSData *)readAllDataChunks;

- (NSData *)createChunkByReadingRange:(NSRange)range package:(LOXPackage *)package;

- (id)
	initWithByteStream:(ePub3::ByteStream*)byteStream
        relativePath:(NSString *)relativePath
        pack:(LOXPackage *)package;

@end
