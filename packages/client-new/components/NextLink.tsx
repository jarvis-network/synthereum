import Link from "next/link";
import React from "react";

const NextLinkAdapter = ({ to, ...props}) => <Link {...props} href={to} />

export default NextLinkAdapter;
