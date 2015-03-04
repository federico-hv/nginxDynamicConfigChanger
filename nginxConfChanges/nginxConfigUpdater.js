
//Underscore to compare the array of ips on the local file and the result array of the call to aws api
var _und = require('underscore');

//child process to execute a bash command
var exec = require('child_process').exec;

//To read and write the nginx conf file
var fs = require('fs');

//AWS skd to make the api calls
var AWS = require('aws-sdk');
AWS.config.update({region: 'the corresponding region'});
AWS.config.update({accessKeyId: 'Your access key id', secretAccessKey: 'Your secret access key'});

//This variable is the AMI of the app instances
var imageId = "your app instances imageId";


//EC2 object
var ec2 = new AWS.EC2({apiVersion: '2014-10-01'});


//First we get all the healthy instances

var params = {
  IncludeAllInstances:false,
  Filters:[
    { Name:'instance-state-name',Values:['running'] }, //This isn't actually necessary since IncludeAllIntances is set to false
    { Name:'instance-status.reachability',Values:['passed'] },
    { Name:'instance-status.status',Values:['ok'] },
    { Name:'system-status.reachability',Values:['passed'] },
    { Name:'system-status.status',Values:['ok'] }
  ]
}; 

ec2.describeInstanceStatus(params, function(err, data) {
  if (err) console.log(err, err.stack); 
  else{
    //array used to collect the healthy instances' id
    var ids = [];
    var statuses = data.InstanceStatuses;

    
    //The final array contains only the IntanceIds of the healthy app instances. 
    for(var key in statuses){
      ids.push(statuses[key].InstanceId);
    }

    params = {
      InstanceIds:ids, //These are the healthy instances
      Filters: [
        { Name:'image-id',Values:[imageId] },
        { Name:'instance-state-name',Values:['running'] }
      ]
    };


    ec2.describeInstances(params, function(err, data) {
          if (err)  console.log(err, err.stack); 
          else{
              var reservations = data.Reservations;


              var appInstances = [];
              var ips = [];

              for(var key in reservations)
              {
                  for(var key2 in reservations[key].Instances)
                  {
                    ips.push(reservations[key].Instances[key2].PublicIpAddress);
                    console.log('APP_IP: '+reservations[key].Instances[key2].PublicIpAddress);
                  }              
              }


              fs.readFile('/etc/nginx/ipsFile', 'utf8', function (err,data) {
                      if (err) {
                          //See if file exists and close if it does. If it doesn't  continue with this code:

                          //If this is the first time the codes runs it will create the ipsFile
                          fs.writeFile('/etc/nginx/ipsFile',ips.toString(),function(err){
                                if(err){
                                  console.log('Error writing ips file.');
                                }
                                else
                                {
                                  console.log('The ipsFile has been created')
                                }
                          });
                      }
                      else{

                          var ipsFileContent = data.split(',');

                          ipsFileContent.sort();
                          ips.sort();

                          if(!_und.isEqual(ipsFileContent,ips)){

                              //Here we read the nginx config file, remove the server lines and create new ones with the healthy instances

                              fs.readFile('/etc/nginx/nginx.conf', 'utf8', function (err,data) {
                                        if (err) {
                                          return console.log(err);
                                        }
                                        else{
                                          var parts = data.split('ip_hash;');
                                          var partOne = parts[0];
                                          var partTwo = parts[1].substring(parts[1].indexOf('}'),parts[1].length);

                                          var serversContent = 'ip_hash;\n';

                                          
                                          for(var key in ips){
                                            serversContent+='\t\tserver '+ips[key]+':443;\n';
                                          }
                                          

                                          var fileContent = partOne+serversContent+'\t'+partTwo;

                                          fs.writeFile('/etc/nginx/nginx.conf',fileContent,function(err){
                                            if(err){
                                              console.log('Error writing file.');
                                            }
                                            else
                                            {
                                              console.log('Check your new file.');
                                              fs.writeFile('/etc/nginx/ipsFile',ips.toString(),function(err){
                                                if(err){
                                                  console.log('Error writing ips file.');
                                                }
                                                else
                                                {
                                                  console.log('Check your new ips file.');
                                                  exec('sudo service nginx reload', function(error, stdout, stderr){ console.log(stdout) });
                                                }
                                              });
                                            }
                                          });

                                      }
                              });
                          }
                          else
                          {
                              console.log('There are no new instances to add');
                          }

                      }
              });
          }
    });
  }           
});









