#!/usr/bin/env -S dmd -run

import std.conv : to;
import std.exception : enforce;
import std.file : readText;
import std.format : format;
import std.json : JSONValue, parseJSON;
import std.stdio : File, stdin, stdout, writeln, writefln;

enum alreadyVerified = "Contract source code already verified";
enum indent = "    ";
enum line = "--------------------------------";

enum Network
{
    mainnet = 1,
    ropsten = 3,
    kovan = 42,
}

void main(string[] args)
{
    import std.getopt : config, defaultGetoptPrinter, getopt;

    uint skipContractsCount = 0;
    Network network = Network.kovan;

    auto helpInformation = args.getopt(
        "skipContractsCount", "How many contracts to skip verifying from the list. Default is 0.", &skipContractsCount,
        "network", "Network id identifying the 'networks/<id>[_args].json' files to use", &network,
    );

    if (helpInformation.helpWanted)
    {
        defaultGetoptPrinter(
            "verify-contracts - verifies contracts on Etherscan, based on 'networks/<id>[_args].json' files",
            helpInformation.options
        );
        return;
    }

    const contractAddresses = "./networks/%s.json".format(cast(int)network)
        .readText.parseJSON.array[skipContractsCount .. $];
    const allContractArgs = "./networks/%s_args.json".format(cast(int)network)
        .readText.parseJSON.object;

    writefln(
        "Starting verification on network='%s' from contract='%s' (index='%s')\n",
        network,
        contractAddresses[0]["contractName"].str,
        skipContractsCount,
    );

    foreach (idx, info; contractAddresses)
    {
        const contractName = info["contractName"].str;
        const contractAddress = info["address"].str;
        const contractArgs = allContractArgs[contractAddress];
        writefln("%s> [%s/%s] '%s' '%s'",
           indent,
           skipContractsCount + idx + 1, skipContractsCount + contractAddresses.length,
           contractName, contractAddress);
        const tmpArgsFilepath = "./tmp-arguments.js";
        writeArgumentsFile(tmpArgsFilepath, contractArgs);
        import std.file : remove;
        scope (success) remove(tmpArgsFilepath);
        const cmd = `yarn hardhat verify --network %s --constructor-args ./tmp-arguments.js %s`
            .format(network, contractAddress);

        const newVerification = runVerify(cmd, alreadyVerified);
        writefln(
            "%s%s Contract '%s' %s: '%s'\n",
            indent,
            newVerification ? "🚀" : "✓",
            contractName,
            newVerification ? "successfully verified" : "previously verified",
            etherscanContractPage(network, contractAddress)
        );
    }

    writefln("All %s contracts verified successfully", contractAddresses.length);

    foreach (info; contractAddresses)
    {
        const contractName = info["contractName"].str;
        const contractAddress = info["address"].str;
        "* `%s`: %s".writefln(contractName, etherscanContractPage(network, contractAddress));
    }
}

void writeArgumentsFile(string path, JSONValue contractArgs)
{
    import std.file : write;
    import std.format : format;
    const data = "module.exports = %s;\n".format(contractArgs.toPrettyString);
    path.write(data);
}

bool runVerify(string command, string matchOutput = null)
{
    import std.algorithm : canFind;
    import std.process : spawnShell, pipe, wait;

    auto p = pipe();
    auto pid = command.spawnShell(stdin, p.writeEnd, p.writeEnd);

    writeln(indent, line);

    bool found = false;
    p.readEnd.copyFileContentTo(stdout, (data) {
        if (matchOutput.length)
            found |= data.canFind(matchOutput);
    }, indent);
    writeln(indent, line);

    const status = pid.wait;

    if (found)
        return false;

    (status == 0)
        .enforce("Command `%s` failed with exit code %s.".format(command, status));

    return true;
}

alias BufferReader = void delegate(scope const char[] data) nothrow @nogc;

void copyFileContentTo(
    File readEnd,
    File writeEnd,
    scope BufferReader teeFunc,
    string indent = null,
)
{
    import std.stdio : KeepTerminator;
    foreach (line; readEnd.byLine(KeepTerminator.yes))
    {
        teeFunc(line);
        if (indent) writeEnd.write(indent);
        writeEnd.write(line);
    }
}

string etherscanEndpoint(Network net)
{
    return net != Network.mainnet
        ? "https://%s.etherscan.io".format(net)
        : "https://etherscan.io";
}

string etherscanContractPage(Network net, string contractAddress)
{
    return "%s/address/%s#code"
        .format(etherscanEndpoint(net), contractAddress);
}

