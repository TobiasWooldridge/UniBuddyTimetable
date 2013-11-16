FlindersTimetable
=================

## Project Brief

This project helps Flinders students find their ideal timetable for a semester.

To build the project, you'll need a modern version of Node.jsm, NPM and git in your classpath.

That should be all you need to get developing!

### Installation

    npm install -g grunt-cli karma bower
    git clone git@github.com:TobiasWooldridge/FlindersTimetable.git
    cd FlindersTimetable
    npm install
    bower install

### Development

#### Webserver

Either make sure you have a webserver pointing to your /build directory, or run

    grunt connect:server &
    
to start a webserver pointing to the project at http://localhost:1337/

A webserver is necessary if you wish to avoid browser security issues. IE still manages to break things because localhost 
is an intranet address, so you'll need to turn down IE's intranet security settings to test in IE.

#### Continuous Building

To build the software continuously, run

    grunt watch
    
This'll compile the LESS/JS for the project into the project's /build directory every time a file changes.
    
### Building

To build FlindersTimetable's application, run

    grunt
    
in the root directory of the project and it'll compile the LESS/JS into the project's /bin directory 
